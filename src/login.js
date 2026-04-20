import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { auth } from "./firebase.js";
import { authState, getAdminStatus } from "./auth.js";
import { setMessage, setStatus } from "./ui.js";

const form = document.querySelector("#loginForm");
const status = document.querySelector("#authStatus");
const title = document.querySelector("#login-title");
const authButton = document.querySelector("#authButton");
const signInMode = document.querySelector("#signInMode");
const signUpMode = document.querySelector("#signUpMode");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");

let mode = "signin";

setStatus("Ready", "online");

authState().then(async (user) => {
  if (!user) return;
  window.location.replace((await getAdminStatus(user)) ? "admin.html" : "scout.html");
});

signInMode.addEventListener("click", () => setMode("signin"));
signUpMode.addEventListener("click", () => setMode("signup"));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(status, mode === "signin" ? "Signing in..." : "Creating account...");

  const username = normalizeUsername(usernameInput.value);
  const email = usernameToEmail(username);
  const password = passwordInput.value;

  if (!username) {
    setMessage(status, "Use 3-24 letters, numbers, underscores, or dashes.", true);
    return;
  }

  try {
    const credential =
      mode === "signup"
        ? await createAccount(username, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
    const isAdmin = await getAdminStatus(credential.user);
    window.location.replace(isAdmin ? "admin.html" : "scout.html");
  } catch (error) {
    setMessage(status, friendlyAuthError(error), true);
  }
});

function setMode(nextMode) {
  mode = nextMode;
  const isSignup = mode === "signup";
  title.textContent = isSignup ? "Sign up" : "Sign in";
  authButton.textContent = isSignup ? "Make account" : "Enter app";
  signInMode.classList.toggle("active", !isSignup);
  signUpMode.classList.toggle("active", isSignup);
  passwordInput.autocomplete = isSignup ? "new-password" : "current-password";
  setMessage(status, "");
}

async function createAccount(username, email, password) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: username });
  return credential;
}

function normalizeUsername(value) {
  const username = value.trim().toLowerCase();
  return /^[a-z0-9_-]{3,24}$/.test(username) ? username : "";
}

function usernameToEmail(username) {
  return `${username}@3181.scout.local`;
}

function friendlyAuthError(error) {
  const messages = {
    "auth/email-already-in-use": "That username is already taken.",
    "auth/invalid-credential": "That username or password is wrong.",
    "auth/invalid-email": "Use a username with letters, numbers, underscores, or dashes.",
    "auth/missing-password": "Enter a password.",
    "auth/weak-password": "Use a password with at least 6 characters.",
    "auth/user-disabled": "That account is disabled.",
    "auth/user-not-found": "That username does not exist yet.",
    "auth/wrong-password": "That username or password is wrong.",
  };

  return messages[error.code] || error.message;
}
