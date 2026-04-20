import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getAnalytics, isSupported as analyticsSupported } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCH5Z_bdX9Y-UjFnHtgtnYPpYp9sCZJboc",
  authDomain: "frc-scouting-3181.firebaseapp.com",
  projectId: "frc-scouting-3181",
  storageBucket: "frc-scouting-3181.firebasestorage.app",
  messagingSenderId: "893271056645",
  appId: "1:893271056645:web:d19a8dba3962fcb548976c",
  measurementId: "G-1TB1M80Y5G",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

analyticsSupported().then((supported) => {
  if (supported) {
    getAnalytics(app);
  }
});
