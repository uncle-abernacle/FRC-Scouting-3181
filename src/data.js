import { supabase, isSupabaseConfigured } from "./supabase.js";
import { requireAdmin } from "./auth.js";
import { defaultQuestions } from "./questions.js";
import { emptyState, escapeHtml, setStatus } from "./ui.js";

const state = {
  submissions: [],
  selectedId: null,
};

const questionLabels = new Map(defaultQuestions.map((question) => [question.id, question.label]));

const els = {
  submissionList: document.querySelector("#submissionList"),
  submissionDetail: document.querySelector("#submissionDetail"),
  exportButton: document.querySelector("#exportButton"),
};

function renderSubmissions() {
  els.submissionList.innerHTML = "";

  if (!state.submissions.length) {
    els.submissionList.append(emptyState("No submissions yet", "Scout a match and recent entries will show up here."));
    renderDetail(null);
    return;
  }

  if (!state.selectedId || !state.submissions.some((submission) => submission.id === state.selectedId)) {
    state.selectedId = state.submissions[0].id;
  }

  state.submissions.forEach((submission) => {
    const item = document.createElement("article");
    item.className = "submission-item";
    item.dataset.submissionId = submission.id;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.classList.toggle("active", submission.id === state.selectedId);
    const answered = Object.keys(submission.answers || {}).length;
    item.innerHTML = `
      <div class="item-topline">
        <div>
          <strong>Team ${escapeHtml(submission.team_number)} / Match ${escapeHtml(submission.match_number)}</strong>
          <div class="meta">${escapeHtml(submission.event_code)} / ${escapeHtml(submission.alliance)} ${escapeHtml(submission.station)} / start ${escapeHtml(submission.starting_location || "unknown")} / ${answered} answers</div>
          <div class="meta">Scout: ${escapeHtml(submission.scout_name)} ${submission.scout_email ? `(${escapeHtml(submission.scout_email)})` : ""}</div>
        </div>
      </div>
      <div class="item-actions">
        <button class="small-button" type="button" data-open="${submission.id}">Open</button>
        <button class="small-button danger" type="button" data-delete="${submission.id}">Delete</button>
      </div>
    `;
    els.submissionList.append(item);
  });

  renderDetail(state.submissions.find((submission) => submission.id === state.selectedId));
}

function renderDetail(submission) {
  els.submissionDetail.innerHTML = "";

  if (!submission) {
    els.submissionDetail.append(emptyState("Select a submission", "Click a match on the left to see every answer."));
    return;
  }

  const answers = Object.entries(submission.answers || {});
  const detail = document.createElement("article");
  detail.className = "submission-detail-card";
  detail.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">Submission detail</p>
        <h3>Team ${escapeHtml(submission.team_number)} / Match ${escapeHtml(submission.match_number)}</h3>
      </div>
      <button class="small-button danger" type="button" data-delete="${submission.id}">Delete</button>
    </div>
    <div class="detail-grid">
      ${detailRow("Event", submission.event_code)}
      ${detailRow("Alliance", `${submission.alliance || ""} ${submission.station || ""}`.trim())}
      ${detailRow("Starting location", submission.starting_location || "Not entered")}
      ${detailRow("Preload fuel", submission.preload_fuel || "Not entered")}
      ${detailRow("Scout", submission.scout_name)}
      ${detailRow("Scout email", submission.scout_email)}
      ${detailRow("Submitted", formatDate(submission.created_at))}
    </div>
    <div class="detail-section">
      <p class="question-title">Notes</p>
      <p class="meta">${escapeHtml(submission.notes || "No notes")}</p>
    </div>
    <div class="detail-section">
      <p class="question-title">Answers</p>
      <div class="answer-list">
        ${
          answers.length
            ? answers.map(([key, value]) => detailRow(formatAnswerKey(key), formatAnswerValue(value))).join("")
            : '<p class="meta">No dynamic answers recorded.</p>'
        }
      </div>
    </div>
  `;

  els.submissionDetail.append(detail);
}

function detailRow(label, value) {
  return `
    <div class="detail-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value ?? "")}</strong>
    </div>
  `;
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString();
}

function formatAnswerKey(key) {
  const words = String(key)
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return questionLabels.get(key) || words;
}

function formatAnswerValue(value) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "Not entered";
  if (typeof value === "object") return JSON.stringify(value);
  return value;
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

async function deleteSubmission(id) {
  const submission = state.submissions.find((item) => item.id === id);
  const label = submission ? `Team ${submission.team_number} / Match ${submission.match_number}` : "this submission";

  if (!confirm(`Delete ${label}? This cannot be undone.`)) {
    return;
  }

  const { error } = await supabase.from("submissions").delete().eq("id", id);
  if (error) {
    alert(error.message);
    return;
  }

  if (state.selectedId === id) {
    state.selectedId = null;
  }
  await loadSubmissions();
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
  els.submissionList.addEventListener("click", (event) => {
    const deleteId = event.target.dataset.delete;
    const openId = event.target.dataset.open || event.target.closest("[data-submission-id]")?.dataset.submissionId;

    if (deleteId) {
      event.stopPropagation();
      deleteSubmission(deleteId);
      return;
    }

    if (openId) {
      state.selectedId = openId;
      renderSubmissions();
    }
  });
  els.submissionList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const id = event.target.closest("[data-submission-id]")?.dataset.submissionId;
    if (!id) return;
    event.preventDefault();
    state.selectedId = id;
    renderSubmissions();
  });
  els.submissionDetail.addEventListener("click", (event) => {
    const deleteId = event.target.dataset.delete;
    if (deleteId) {
      deleteSubmission(deleteId);
    }
  });
  renderSubmissions();
  await loadSubmissions();
  subscribeToSubmissions();
}
