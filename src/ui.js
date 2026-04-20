export function setStatus(text, mode = "") {
  const element = document.querySelector("#connectionStatus");
  if (!element) return;
  element.textContent = text;
  element.className = `status-pill ${mode}`.trim();
}

export function setMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.style.color = isError ? "var(--danger)" : "var(--muted)";
}

export function emptyState(label = "No items yet", detail = "Once Supabase has data, it will appear here.") {
  const template = document.querySelector("#emptyStateTemplate");
  const node = template.content.cloneNode(true);
  node.querySelector("strong").textContent = label;
  node.querySelector("span").textContent = detail;
  return node;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[char];
  });
}
