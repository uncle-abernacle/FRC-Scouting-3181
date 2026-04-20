import { supabase, isSupabaseConfigured } from "./supabase.js";
import { requireAdmin } from "./auth.js";
import { emptyState, escapeHtml, setStatus } from "./ui.js";

const state = {
  submissions: [],
};

const els = {
  submissionList: document.querySelector("#submissionList"),
  exportButton: document.querySelector("#exportButton"),
};

function renderSubmissions() {
  els.submissionList.innerHTML = "";

  if (!state.submissions.length) {
    els.submissionList.append(emptyState("No submissions yet", "Scout a match and recent entries will show up here."));
    return;
  }

  state.submissions.forEach((submission) => {
    const item = document.createElement("article");
    item.className = "submission-item";
    const answered = Object.keys(submission.answers || {}).length;
    item.innerHTML = `
      <div class="item-topline">
        <div>
          <strong>Team ${escapeHtml(submission.team_number)} / Match ${escapeHtml(submission.match_number)}</strong>
          <div class="meta">${escapeHtml(submission.event_code)} / ${escapeHtml(submission.alliance)} ${escapeHtml(submission.station)} / start ${escapeHtml(submission.starting_location || "unknown")} / ${answered} answers</div>
          <div class="meta">Scout: ${escapeHtml(submission.scout_name)} ${submission.scout_email ? `(${escapeHtml(submission.scout_email)})` : ""}</div>
        </div>
      </div>
      <p class="meta">${escapeHtml(submission.notes || "No notes")}</p>
    `;
    els.submissionList.append(item);
  });
}

function toCsvValue(value) {
  const text = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const rows = [
    [
      "eventCode",
      "matchNumber",
      "teamNumber",
      "scoutName",
      "scoutEmail",
      "alliance",
      "station",
      "startingLocation",
      "preloadFuel",
      "notes",
      "answers",
    ],
    ...state.submissions.map((submission) => [
      submission.event_code,
      submission.match_number,
      submission.team_number,
      submission.scout_name,
      submission.scout_email,
      submission.alliance,
      submission.station,
      submission.starting_location,
      submission.preload_fuel,
      submission.notes,
      submission.answers,
    ]),
  ];
  const csv = rows.map((row) => row.map(toCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `3181-scouting-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function loadSubmissions() {
  setStatus("Syncing", "");
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    console.warn(error);
    renderSubmissions();
    setStatus("Admin blocked", "offline");
    return;
  }

  state.submissions = data || [];
  renderSubmissions();
  setStatus("Online", "online");
}

function subscribeToSubmissions() {
  supabase
    .channel("submissions-data")
    .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, loadSubmissions)
    .subscribe();
}

if (!isSupabaseConfigured) {
  setStatus("Needs config", "offline");
} else if (await requireAdmin()) {
  els.exportButton.addEventListener("click", exportCsv);
  renderSubmissions();
  await loadSubmissions();
  subscribeToSubmissions();
}
