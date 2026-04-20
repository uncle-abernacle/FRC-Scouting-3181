import { supabase } from "./supabase.js";

export async function authState() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user || null;
}

export async function getAdminStatus(user) {
  if (!user) return false;

  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.warn(error);
    return false;
  }

  return Boolean(data?.is_admin);
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

export function wireSignOut() {
  const button = document.querySelector("#signOutButton");
  if (!button || button.dataset.bound) return;

  button.dataset.bound = "true";
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    await signOutAndRedirect();
  });
}

export async function signOutAndRedirect() {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.warn(error);
    } finally {
      localStorage.removeItem("scoutDraft3181");
      window.location.href = "index.html";
    }
}

wireSignOut();
