# 3181 FRC Scouting

Mobile-first scouting app for FRC Team 3181. Scouts can submit match data from phones, and admins can sign in with Firebase Authentication to change the questions that appear in the scouting form.

## What is included

- Pink and black 3181 UI built for phones first
- Firebase Web SDK setup using your `frc-scouting-3181` project
- Dynamic questions stored in Cloud Firestore
- Admin sign-in with Firebase Auth email/password
- Question editor for counter, number, select, toggle, and text questions
- Recent submission viewer and CSV export
- Local draft saving so accidental refreshes do not wipe a scout's form
- Firestore security rules for public submissions and signed-in admin reads/edits

## Firebase setup

1. In Firebase Console, enable **Authentication** and turn on **Email/Password** sign-in.
2. Create your admin user in Firebase Authentication.
3. Enable **Cloud Firestore**.
4. Publish the rules in `firestore.rules`.
5. Optional but recommended: deploy with Firebase Hosting.

```powershell
npm install -g firebase-tools
firebase login
firebase deploy
```

The app uses these collections:

- `questions`: admin-managed scouting questions
- `submissions`: scout form submissions

If there are no Firestore questions yet, the app shows starter questions locally so you can test the flow immediately.

## Local testing

Because the app uses JavaScript modules, serve it from a local web server:

```powershell
npx serve .
```

Then open the local URL on your computer or phone.
