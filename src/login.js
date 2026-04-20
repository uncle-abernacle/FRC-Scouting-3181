import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { auth } from "./firebase.js";
import { authState, getAdminStatus } from "./auth.js";
import { setMessage, setStatus } from "./ui.js";

const form = document.querySelector("#loginForm");
const status = document.querySelector("#authStatus");

setStatus("Ready", "online");

authState().then(async (user) => {
  if (!user) return;
  window.location.replace((await getAdminStatus(user)) ? "admin.html" : "scout.html");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(status, "Signing in...");

  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const isAdmin = await getAdminStatus(credential.user);
    window.location.replace(isAdmin ? "admin.html" : "scout.html");
  } catch (error) {
    setMessage(status, error.message, true);
  }
});
