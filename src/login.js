import { supabase, isSupabaseConfigured } from "./supabase.js";
import { authState, getAdminStatus } from "./auth.js";
import { setMessage, setStatus } from "./ui.js";

const form = document.querySelector("#loginForm");
const status = document.querySelector("#authStatus");
const title = document.querySelector("#login-title");
const authButton = document.querySelector("#authButton");
const signInMode = document.querySelector("#signInMode");
const signUpMode = document.querySelector("#signUpMode");
const usernameInput = document.querySelector("#username");
const usernameFormatNote = document.querySelector("#usernameFormatNote");
const passwordInput = document.querySelector("#password");
const passwordToggle = document.querySelector("#passwordToggle");

let mode = "signin";

setStatus(isSupabaseConfigured ? "Ready" : "Needs config", isSupabaseConfigured ? "online" : "offline");

authState().then(async (user) => {
  if (!user) return;
  window.location.replace((await getAdminStatus(user)) ? "admin.html" : "match.html");
});

signInMode.addEventListener("click", () => setMode("signin"));
signUpMode.addEventListener("click", () => setMode("signup"));
passwordToggle.addEventListener("click", togglePasswordVisibility);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isSupabaseConfigured) {
    setMessage(status, "Add your Supabase URL and anon key in src/supabase.js first.", true);
    return;
  }

  setMessage(status, mode === "signin" ? "Signing in..." : "Creating account...");

  const username = normalizeUsername(usernameInput.value);
  const password = passwordInput.value;

  if (!username) {
    setMessage(status, "Use 3-24 letters, numbers, underscores, or dashes.", true);
    return;
  }

  try {
    const user = mode === "signup" ? await createAccount(username, password) : await signIn(username, password);
    const isAdmin = await getAdminStatus(user);
    window.location.replace(isAdmin ? "admin.html" : "match.html");
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
  usernameInput.placeholder = isSignup ? "firstnameL" : "";
  usernameFormatNote.classList.toggle("hidden", !isSignup);
  passwordInput.autocomplete = isSignup ? "new-password" : "current-password";
  setMessage(status, "");
}

function togglePasswordVisibility() {
  const shouldShow = passwordInput.type === "password";
  passwordInput.type = shouldShow ? "text" : "password";
  passwordToggle.textContent = shouldShow ? "Hide" : "Show";
  passwordToggle.setAttribute("aria-pressed", String(shouldShow));
}

async function createAccount(username, password) {
  const existingEmail = await resolveAuthEmailForUsername(username);
  if (existingEmail) {
    throw new Error("That username is already taken.");
  }

  const hiddenEmail = createHiddenEmail(username);
  const { data, error } = await supabase.auth.signUp({
    email: hiddenEmail,
    password,
    options: {
      data: { username },
    },
  });

  if (error) throw error;

  if (!data.session) {
    throw new Error("Turn off Supabase email confirmation, then try signing up again.");
  }

  const user = data.user;
  if (!user) {
    throw new Error("Check your email confirmation setting, then sign in.");
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: user.id,
    username,
    auth_email: hiddenEmail,
    is_admin: false,
  });

  if (profileError && profileError.code !== "23505") {
    throw profileError;
  }

  return user;
}

async function signIn(username, password) {
  const email = (await resolveAuthEmailForUsername(username)) || legacyUsernameToEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  if (!data.user) {
    throw new Error("That username or password is wrong.");
  }

  await ensureProfile(data.user, username);
  return data.user;
}

async function ensureProfile(user, username) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      username,
      auth_email: user.email,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (error) {
    console.warn(error);
  }
}

function normalizeUsername(value) {
  const username = value.trim().toLowerCase();
  return /^[a-z0-9_-]{3,24}$/.test(username) ? username : "";
}

function legacyUsernameToEmail(username) {
  return `${username}@3181scouting.app`;
}

function createHiddenEmail(username) {
  const token = typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${username}--${token}@3181scouting.app`;
}

async function resolveAuthEmailForUsername(username) {
  const { data, error } = await supabase.rpc("get_auth_email_for_username", {
    input_username: username,
  });

  if (error) {
    console.warn(error);
    return null;
  }

  return data || null;
}

function friendlyAuthError(error) {
  const messages = {
    email_address_invalid: "Use a username with letters, numbers, underscores, or dashes.",
    email_exists: "That username is already taken.",
    invalid_credentials: "That username or password is wrong.",
    over_email_send_rate_limit: "Supabase is trying to send confirmation emails. Turn off email confirmation in Supabase Auth settings, then try again.",
    over_request_rate_limit: "Too many signup attempts. Wait a minute, then try again.",
    user_already_exists: "That username is already taken.",
    weak_password: "Use a stronger password.",
  };

  if (String(error.message).toLowerCase().includes("email rate limit")) {
    return "Supabase is trying to send confirmation emails. Turn off email confirmation in Supabase Auth settings, then try again.";
  }

  if (String(error.message).toLowerCase().includes("already taken")) {
    return "That username is already taken.";
  }

  return messages[error.code] || error.message;
}
