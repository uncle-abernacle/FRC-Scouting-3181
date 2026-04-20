import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

export function authState() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function getAdminStatus(user) {
  if (!user?.email) return false;
  const adminDoc = await getDoc(doc(db, "adminEmails", user.email));
  return adminDoc.exists();
}

export async function requireUser() {
  const user = await authState();
  if (!user) {
    window.location.replace("index.html");
    return null;
  }
  wireSignOut();
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user) return null;

  const isAdmin = await getAdminStatus(user);
  if (!isAdmin) {
    window.location.replace("scout.html");
    return null;
  }

  revealAdminLinks();
  return user;
}

export async function setupAuthedPage() {
  const user = await requireUser();
  if (!user) return null;

  if (await getAdminStatus(user)) {
    revealAdminLinks();
  }

  return user;
}

export function revealAdminLinks() {
  document.querySelectorAll(".admin-only").forEach((element) => element.classList.remove("hidden"));
  document.querySelectorAll(".admin-gated").forEach((element) => element.classList.remove("hidden"));
}

function wireSignOut() {
  const button = document.querySelector("#signOutButton");
  if (!button || button.dataset.bound) return;

  button.dataset.bound = "true";
  button.addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("index.html");
  });
}
