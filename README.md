## Firebase setup (required — do this first)

This app stores everything (portfolio, testimonials, quote requests,
orders, contact messages, and the admin login) in a real Firebase project
instead of the browser's localStorage. Nothing will load or save until you
connect one:

1. **Create a project** at [console.firebase.google.com](https://console.firebase.google.com)
   (the free Spark plan is enough).
2. **Add a Web app.** Project Overview → click the `</>` (Web) icon → register
   an app (no need for Firebase Hosting) → copy the `firebaseConfig` object
   it shows you; you'll need those values in step 6.
3. **Enable Authentication.** Build → Authentication → Get started → enable
   the **Email/Password** sign-in provider → Users tab → Add user → enter an
   email (e.g. `admin@mosdal.com`) and a password. This is the only account
   that can sign into `/admin`.
4. **Enable Firestore.** Build → Firestore Database → Create database (start
   in production mode, pick any region) → Rules tab → paste the contents of
   [`firebase/firestore.rules`](./firebase/firestore.rules) → Publish.
   Then Indexes tab → paste/import [`firebase/firestore.indexes.json`](./firebase/firestore.indexes.json)
   (or just try loading the Testimonials page once deployed — Firestore
   will fail with an error containing a direct link that creates the
   missing index for you in one click).
5. **Enable Storage.** Build → Storage → Get started → Rules tab → paste the
   contents of [`firebase/storage.rules`](./firebase/storage.rules) → Publish.
6. **Set your environment variables.** Copy `.env.example` to `.env` and
   fill in the values from step 2:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_ADMIN_EMAIL=admin@mosdal.com   # the email you used in step 3
   ```
   If you're deploying on Vercel, add the same variables under
   Project → Settings → Environment Variables, then trigger a fresh deploy
   (Vite bakes `VITE_*` variables in at build time, so they only take
   effect on the next build after you add/change them).
7. `npm install` (the Firebase SDK is already in `package.json`), then
   `npm run dev`.

The admin login screen still only asks for a password — `VITE_ADMIN_EMAIL`
tells Firebase Auth which account that password belongs to. Every portfolio
add/edit/delete, quote request, order, testimonial approval, and contact
message now goes through Firestore with the security rules above, so:
- Site visitors can submit quotes, orders, testimonials, and contact
  messages, and can read the public portfolio and approved reviews.
- Only someone signed in as the admin can see quote/order/message details,
  approve or reject testimonials, and add/edit/remove portfolio items
  (including uploading images, which go to Firebase Storage).

The Contact page now saves every submission to the `contact_messages`
collection and shows up in Admin → Messages (with an unread badge), in
addition to trying to send an EmailJS notification the same way the Quote
and Testimonial forms do — see [`src/lib/emailjs.ts`](./src/lib/emailjs.ts)
for the one-time EmailJS template setup.



# Welcome to your OnSpace project

## How can I edit this code?

There are several ways of editing your application.

**Use OnSpace**

Simply visit the [OnSpace Project]() and start prompting.

Changes made via OnSpace will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in OnSpace.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [OnSpace]() and click on Share -> Publish.
# Mosdalbranding
