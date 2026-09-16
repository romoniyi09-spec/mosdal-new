import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  type DocumentData,
} from "firebase/firestore";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { db, auth, ADMIN_EMAIL } from "@/lib/firebaseClient";
import type {
  PortfolioItem,
  Testimonial,
  QuoteRequest,
  Order,
  ContactMessage,
} from "@/types";

// ════════════════════════════════════════════════════════════════════════
// Every function below talks to Firebase (Firestore + Auth), so data is
// shared across devices/browsers and survives clearing site data.
// See firebase/firestore.rules for the security rules this relies on,
// and the README for one-time project setup.
//
// Note: Firebase Storage has been removed from this project (it now
// requires a billing account). Portfolio images are stored as Base64
// data URLs directly inside their Firestore documents instead. The
// uploadPortfolioImage() helper below handles the resize + compress so
// each image stays under Firestore's 1 MiB per-document limit.
// ════════════════════════════════════════════════════════════════════════

function toISO(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

/** Re-reads a doc right after a write so callers get server-resolved
 *  fields back (e.g. the real `createdAt` timestamp), the same way the
 *  old Supabase code used `.select().single()` after an insert/update.
 *
 *  ⚠️ Only safe to call for collections whose read rule allows the
 *  current caller to read the doc back. That's true for portfolio_items
 *  (public read) but NOT for testimonials / quote_requests / orders /
 *  contact_messages when written by an anonymous visitor — those four
 *  build their return value locally instead. */
async function getDocById<T>(
  collectionName: string,
  id: string,
  mapper: (id: string, data: DocumentData) => T
): Promise<T> {
  const snap = await getDoc(doc(db, collectionName, id));
  if (!snap.exists()) {
    throw new Error(`Document ${id} in "${collectionName}" was not found after the write.`);
  }
  return mapper(snap.id, snap.data());
}

// ─── Mappers: Firestore doc ⇆ App types (camelCase throughout) ─────────

const mapPortfolio = (id: string, data: DocumentData): PortfolioItem => ({
  id,
  title: data.title,
  category: data.category,
  description: data.description,
  imageUrl: data.imageUrl,
  featured: data.featured,
  createdAt: toISO(data.createdAt),
});

const mapTestimonial = (id: string, data: DocumentData): Testimonial => ({
  id,
  name: data.name,
  company: data.company,
  rating: data.rating,
  message: data.message,
  avatarUrl: data.avatarUrl ?? undefined,
  approved: data.approved,
  createdAt: toISO(data.createdAt),
});

const mapQuote = (id: string, data: DocumentData): QuoteRequest => ({
  id,
  name: data.name,
  email: data.email,
  phone: data.phone,
  service: data.service,
  details: data.details,
  budget: data.budget,
  deadline: data.deadline,
  status: data.status,
  createdAt: toISO(data.createdAt),
});

const mapOrder = (id: string, data: DocumentData): Order => ({
  id,
  name: data.name,
  email: data.email,
  phone: data.phone,
  service: data.service,
  quantity: data.quantity,
  specifications: data.specifications,
  deliveryAddress: data.deliveryAddress,
  total: data.total,
  status: data.status,
  createdAt: toISO(data.createdAt),
});

const mapContactMessage = (id: string, data: DocumentData): ContactMessage => ({
  id,
  name: data.name,
  email: data.email,
  subject: data.subject,
  message: data.message,
  read: data.read ?? false,
  createdAt: toISO(data.createdAt),
});

// ─── Portfolio ─────────────────────────────────────────────────────────

export async function getPortfolioItems(): Promise<PortfolioItem[]> {
  const snap = await getDocs(query(collection(db, "portfolio_items"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => mapPortfolio(d.id, d.data()));
}

export type NewPortfolioItem = Omit<PortfolioItem, "id" | "createdAt">;

export async function addPortfolioItem(item: NewPortfolioItem): Promise<PortfolioItem> {
  const created = await addDoc(collection(db, "portfolio_items"), {
    title: item.title,
    category: item.category,
    description: item.description,
    imageUrl: item.imageUrl,
    featured: item.featured,
    createdAt: serverTimestamp(),
  });
  return getDocById("portfolio_items", created.id, mapPortfolio);
}

export async function updatePortfolioItem(
  id: string,
  item: NewPortfolioItem
): Promise<PortfolioItem> {
  await updateDoc(doc(db, "portfolio_items", id), {
    title: item.title,
    category: item.category,
    description: item.description,
    imageUrl: item.imageUrl,
    featured: item.featured,
  });
  return getDocById("portfolio_items", id, mapPortfolio);
}

export async function deletePortfolioItem(id: string): Promise<void> {
  await deleteDoc(doc(db, "portfolio_items", id));
}

/**
 * Converts an image file to a Base64 data URL that's stored directly in
 * the Firestore document (no Firebase Storage needed, so the app stays
 * on the free Spark plan). The image is resized and JPEG-compressed so
 * it fits comfortably inside Firestore's 1 MiB per-document limit.
 *
 * Trade-offs vs. Firebase Storage:
 *  - No credit card required; stays free.
 *  - Each image is capped at ~700 KB after compression.
 *  - Larger images are scaled down automatically to fit.
 */
export async function uploadPortfolioImage(file: File): Promise<string> {
  const MAX_DIM = 1600;          // longest edge, in pixels
  const MAX_BYTES = 700 * 1024;  // ~700 KB ceiling for the final data URL

  // 1. Read the file into a data URL
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read the selected file."));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

  // 2. If it's already small enough, use it as-is
  if (original.length <= MAX_BYTES) return original;

  // 3. Otherwise, decode, resize, and re-encode as JPEG
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Couldn't decode the selected image."));
    el.src = original;
  });

  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser.");
  ctx.drawImage(img, 0, 0, w, h);

  // Progressively lower JPEG quality until it fits under the limit
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const out = canvas.toDataURL("image/jpeg", quality);
    if (out.length <= MAX_BYTES) return out;
  }

  throw new Error(
    "Image is too large even after compression. Please use a smaller image, or paste an image URL instead."
  );
}

// ─── Testimonials ──────────────────────────────────────────────────────

/** Admin-only: every testimonial, pending or approved. */
export async function getTestimonials(): Promise<Testimonial[]> {
  const snap = await getDocs(query(collection(db, "testimonials"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => mapTestimonial(d.id, d.data()));
}

/** Public: only approved testimonials, for the Testimonials page. */
export async function getApprovedTestimonials(): Promise<Testimonial[]> {
  const snap = await getDocs(
    query(
      collection(db, "testimonials"),
      where("approved", "==", true),
      orderBy("createdAt", "desc")
    )
  );
  return snap.docs.map((d) => mapTestimonial(d.id, d.data()));
}

export type NewTestimonial = Omit<Testimonial, "id" | "createdAt" | "approved">;

export async function addTestimonial(t: NewTestimonial): Promise<Testimonial> {
  const created = await addDoc(collection(db, "testimonials"), {
    name: t.name,
    company: t.company,
    rating: t.rating,
    message: t.message,
    avatarUrl: t.avatarUrl ?? null,
    approved: false,
    createdAt: serverTimestamp(),
  });
  // NOTE: We build the return value locally instead of re-reading the
  // doc. The public read rule only allows reading testimonials where
  // `approved == true`, so an anonymous visitor can't read back the
  // unapproved doc they just created. The stored `createdAt` on the
  // server is still the real server timestamp via serverTimestamp().
  return {
    id: created.id,
    name: t.name,
    company: t.company,
    rating: t.rating,
    message: t.message,
    avatarUrl: t.avatarUrl ?? undefined,
    approved: false,
    createdAt: new Date().toISOString(),
  };
}

/** Admin-only: mark a pending testimonial as approved so it shows publicly. */
export async function approveTestimonial(id: string): Promise<void> {
  await updateDoc(doc(db, "testimonials", id), { approved: true });
}

/** Admin-only: permanently remove a testimonial (pending or approved). */
export async function rejectTestimonial(id: string): Promise<void> {
  await deleteDoc(doc(db, "testimonials", id));
}

// ─── Quote Requests ─────────────────────────────────────────────────────

/** Admin-only. */
export async function getQuoteRequests(): Promise<QuoteRequest[]> {
  const snap = await getDocs(query(collection(db, "quote_requests"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => mapQuote(d.id, d.data()));
}

export type NewQuoteRequest = Omit<QuoteRequest, "id" | "createdAt" | "status">;

export async function addQuoteRequest(q: NewQuoteRequest): Promise<QuoteRequest> {
  const created = await addDoc(collection(db, "quote_requests"), {
    name: q.name,
    email: q.email,
    phone: q.phone,
    service: q.service,
    details: q.details,
    budget: q.budget,
    deadline: q.deadline,
    status: "new",
    createdAt: serverTimestamp(),
  });
  // Same reason as addTestimonial: the read rule requires auth, so we
  // construct the return value locally rather than re-reading.
  return {
    id: created.id,
    name: q.name,
    email: q.email,
    phone: q.phone,
    service: q.service,
    details: q.details,
    budget: q.budget,
    deadline: q.deadline,
    status: "new",
    createdAt: new Date().toISOString(),
  };
}

export async function updateQuoteStatus(
  id: string,
  status: QuoteRequest["status"]
): Promise<void> {
  await updateDoc(doc(db, "quote_requests", id), { status });
}

// ─── Orders ──────────────────────────────────────────────────────────────

/** Admin-only. */
export async function getOrders(): Promise<Order[]> {
  const snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => mapOrder(d.id, d.data()));
}

export type NewOrder = Omit<Order, "id" | "createdAt" | "status" | "total">;

export async function addOrder(o: NewOrder): Promise<Order> {
  const created = await addDoc(collection(db, "orders"), {
    name: o.name,
    email: o.email,
    phone: o.phone,
    service: o.service,
    quantity: o.quantity,
    specifications: o.specifications,
    deliveryAddress: o.deliveryAddress,
    total: "TBD — Subject to quotation",
    status: "pending",
    createdAt: serverTimestamp(),
  });
  // Same reason as addTestimonial: the read rule requires auth, so we
  // construct the return value locally rather than re-reading.
  return {
    id: created.id,
    name: o.name,
    email: o.email,
    phone: o.phone,
    service: o.service,
    quantity: o.quantity,
    specifications: o.specifications,
    deliveryAddress: o.deliveryAddress,
    total: "TBD — Subject to quotation",
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

export async function updateOrderStatus(id: string, status: Order["status"]): Promise<void> {
  await updateDoc(doc(db, "orders", id), { status });
}

// ─── Contact Messages ────────────────────────────────────────────────────

/** Admin-only: every message submitted through the Contact page. */
export async function getContactMessages(): Promise<ContactMessage[]> {
  const snap = await getDocs(query(collection(db, "contact_messages"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => mapContactMessage(d.id, d.data()));
}

export type NewContactMessage = Omit<ContactMessage, "id" | "createdAt" | "read">;

export async function addContactMessage(m: NewContactMessage): Promise<ContactMessage> {
  const created = await addDoc(collection(db, "contact_messages"), {
    name: m.name,
    email: m.email,
    subject: m.subject,
    message: m.message,
    read: false,
    createdAt: serverTimestamp(),
  });
  // Same reason as addTestimonial: the read rule requires auth, so we
  // construct the return value locally rather than re-reading.
  return {
    id: created.id,
    name: m.name,
    email: m.email,
    subject: m.subject,
    message: m.message,
    read: false,
    createdAt: new Date().toISOString(),
  };
}

/** Admin-only: toggle a message's read/unread state. */
export async function setContactMessageRead(id: string, read: boolean): Promise<void> {
  await updateDoc(doc(db, "contact_messages", id), { read });
}

/** Admin-only: permanently remove a message. */
export async function deleteContactMessage(id: string): Promise<void> {
  await deleteDoc(doc(db, "contact_messages", id));
}

// ─── Admin Auth (real Firebase Auth session, not a localStorage flag) ──

export async function adminLogin(password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
    return { ok: true };
  } catch (error) {
    // Firebase errors look like: "Firebase: Error (auth/invalid-credential)."
    // Strip that down to something readable for the login form.
    const raw = error instanceof Error ? error.message : "";
    const cleaned = raw.replace(/^Firebase:\s*/, "").replace(/\s*\(auth\/[^)]+\)\.?/, "");
    return { ok: false, error: cleaned || "Invalid password. Please try again." };
  }
}

export async function adminLogout(): Promise<void> {
  await signOut(auth);
}

export async function isAdminLoggedIn(): Promise<boolean> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(!!user);
    });
  });
}

/** Fires immediately with the current state, then on every change. */
export function onAdminAuthStateChange(callback: (loggedIn: boolean) => void): () => void {
  return onAuthStateChanged(auth, (user) => callback(!!user));
}