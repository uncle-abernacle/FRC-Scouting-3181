# 3181 FRC Scouting

Mobile-first scouting app for FRC Team 3181. Scouts sign in with Firebase accounts, submit match data from phones, and admin-marked accounts can change the questions that appear in the scouting form.

## What is included

- Pink and black 3181 UI built for phones first
- Firebase Web SDK setup using your `frc-scouting-3181` project
- Multi-page app: login, scout, admin, and data pages
- Firebase Auth required before scouting
- Admin pages hidden unless the signed-in email is marked as an admin
- Dynamic questions stored in Cloud Firestore
- Question editor for counter, number, select, toggle, and text questions
- Recent submission viewer and CSV export
- Local draft saving so accidental refreshes do not wipe a scout's form
- Firestore security rules for signed-in submissions and admin-only data access

## Firebase setup

1. In Firebase Console, enable **Authentication** and turn on **Email/Password** sign-in.
2. Create accounts for your scouts in Firebase Authentication.
3. Enable **Cloud Firestore**.
4. Publish the rules in `firestore.rules`.
5. Mark admin accounts in Firestore.
6. Optional but recommended: deploy with Firebase Hosting.

## Marking an admin

Create a Firestore collection named `adminEmails`.

For each admin account, add a document whose document ID is the exact email address of that Firebase Auth user.

Example:

- Collection: `adminEmails`
- Document ID: `leadscout@example.com`
- Fields can be anything, such as `role: admin`

Only signed-in users whose email has a matching document can see the Admin and Data links. Firestore rules also block non-admin accounts from editing questions or reading submissions.

```powershell
npm install -g firebase-tools
firebase login
firebase deploy
```

The app uses these collections:

- `questions`: admin-managed scouting questions
- `submissions`: scout form submissions
- `adminEmails`: admin allowlist, keyed by exact email address

If there are no Firestore questions yet, the app shows starter questions locally so you can test the flow immediately.

## Local testing

Because the app uses JavaScript modules, serve it from a local web server:

```powershell
npx serve .
```

Then open the local URL on your computer or phone.
