import { supabase, isSupabaseConfigured } from "./supabase.js";
import { requireAdmin } from "./auth.js";
import { defaultQuestions } from "./questions.js";
import { emptyState, escapeHtml, setStatus } from "./ui.js";

const state = {
  submissions: [],
  selectedId: null,
  questions: defaultQuestions,
};

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
  if (state.selectedId && !state.submissions.some((submission) => submission.id === state.selectedId)) {
    state.selectedId = null;
  }

  state.submissions.forEach((submission) => {
    const item = document.createElement("article");
    item.className = "submission-item";
    item.dataset.submissionId = submission.id;
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
    els.submissionDetail.classList.add("hidden");
    return;
  }

  els.submissionDetail.classList.remove("hidden");
  const answers = orderedAnswerEntries(submission);
  const detail = document.createElement("article");
  detail.className = "submission-detail-card";
  detail.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">Submission detail</p>
        <h3>Team ${escapeHtml(submission.team_number)} / Match ${escapeHtml(submission.match_number)}</h3>
      </div>
      <div class="item-actions">
        <button class="small-button" type="button" data-close-detail="true">Close</button>
        <button class="small-button danger" type="button" data-delete="${submission.id}">Delete</button>
      </div>
    </div>
    <div class="detail-grid">
      ${detailRow("Event", submission.event_code)}
      ${detailRow("Alliance", `${submission.alliance || ""} ${submission.station || ""}`.trim())}
      ${detailRow("Starting location", submission.starting_location || "Not entered")}
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
  return getQuestionLabels().get(key) || words;
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

function getQuestionLabels() {
  return new Map(state.questions.map((question) => [question.id, question.label]));
}

function orderedAnswerEntries(submission) {
  const answers = Object.entries(submission.answers || {});
  const answerMap = new Map(answers);
  const orderedIds = new Set();
  const orderedAnswers = state.questions
    .filter((question) => answerMap.has(question.id))
    .map((question) => {
      orderedIds.add(question.id);
      return [question.id, answerMap.get(question.id)];
    });

  const remainingAnswers = answers.filter(([key]) => !orderedIds.has(key));
  return [...orderedAnswers, ...remainingAnswers];
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

async function loadQuestions() {
  const { data, error } = await supabase
    .from("questions")
    .select("id, label, question_order")
    .order("question_order", { ascending: true });

  if (error) {
    console.warn(error);
    state.questions = defaultQuestions;
    renderSubmissions();
    return;
  }

  state.questions = data?.length
    ? data.map((question) => ({
        id: question.id,
        label: question.label,
        order: question.question_order,
      }))
    : defaultQuestions;
  renderSubmissions();
}

function subscribeToSubmissions() {
  supabase
    .channel("submissions-data")
    .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, loadSubmissions)
    .subscribe();
}

function subscribeToQuestions() {
  supabase
    .channel("questions-data")
    .on("postgres_changes", { event: "*", schema: "public", table: "questions" }, loadQuestions)
    .subscribe();
}

function bindRefreshEvents() {
  window.addEventListener("focus", loadSubmissions);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      loadSubmissions();
    }
  });
}

async function initDataPage() {
  try {
    if (!(await requireAdmin())) return;

    els.exportButton.addEventListener("click", exportCsv);
    els.submissionList.addEventListener("click", (event) => {
      const deleteId = event.target.dataset.delete;
      const openId = event.target.dataset.open;

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
    els.submissionDetail.addEventListener("click", (event) => {
      const deleteId = event.target.dataset.delete;
      if (deleteId) {
        deleteSubmission(deleteId);
        return;
      }

      if (event.target.dataset.closeDetail) {
        state.selectedId = null;
        renderSubmissions();
      }
    });
    renderSubmissions();
    await loadQuestions();
    await loadSubmissions();
    bindRefreshEvents();
    subscribeToQuestions();
    subscribeToSubmissions();
  } catch (error) {
    console.error(error);
    setStatus("Load error", "offline");
  }
}

if (!isSupabaseConfigured) {
  setStatus("Needs config", "offline");
} else {
  void initDataPage();
}
