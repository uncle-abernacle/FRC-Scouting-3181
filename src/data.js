import { supabase, isSupabaseConfigured } from "./supabase.js";
import { requireAdmin } from "./auth.js";
import { defaultQuestions } from "./questions.js";
import { emptyState, escapeHtml, setMessage, setStatus } from "./ui.js";

const state = {
  submissions: [],
  selectedId: null,
  questions: defaultQuestions,
  user: null,
};

const els = {
  submissionList: document.querySelector("#submissionList"),
  submissionDetail: document.querySelector("#submissionDetail"),
  importButton: document.querySelector("#importButton"),
  importFileInput: document.querySelector("#importFileInput"),
  exportButton: document.querySelector("#exportButton"),
  dataStatus: document.querySelector("#dataStatus"),
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

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(value);
      value = "";
      continue;
    }

    if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    if (char !== "\r") {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((csvRow) => csvRow.some((cell) => String(cell || "").trim() !== ""));
}

function questionLookup() {
  const lookup = new Map();
  state.questions.forEach((question) => {
    lookup.set(normalizeHeader(question.id), question);
    lookup.set(normalizeHeader(question.label), question);
  });
  return lookup;
}

function classifyColumn(header, lookup) {
  const normalized = normalizeHeader(header);
  const fieldAliases = {
    event: "event_code",
    eventcode: "event_code",
    match: "match_number",
    matchnumber: "match_number",
    team: "team_number",
    teamnumber: "team_number",
    scout: "scout_name",
    scoutname: "scout_name",
    scoutemail: "scout_email",
    email: "scout_email",
    alliance: "alliance",
    station: "station",
    robotposition: "station",
    position: "station",
    startinglocation: "starting_location",
    startlocation: "starting_location",
    notes: "notes",
    comments: "notes",
    comment: "notes",
    extranotes: "notes",
    answers: "answers",
    submitted: "device_created_at",
    createdat: "device_created_at",
    devicecreatedat: "device_created_at",
  };

  if (fieldAliases[normalized]) {
    return { kind: "field", field: fieldAliases[normalized] };
  }

  const question = lookup.get(normalized);
  if (question) {
    return { kind: "question", question };
  }

  return { kind: "extra", key: normalized || header.trim() };
}

function parseAnswersCell(value) {
  if (!String(value || "").trim()) return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseBoolean(value) {
  const normalized = normalizeHeader(value);
  if (["yes", "true", "1", "y"].includes(normalized)) return true;
  if (["no", "false", "0", "n"].includes(normalized)) return false;
  return null;
}

function coerceAnswerValue(value, question = null) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  if (question?.type === "toggle") {
    const booleanValue = parseBoolean(text);
    return booleanValue === null ? text : booleanValue;
  }

  if (question?.type === "counter" || question?.type === "number") {
    const numericValue = Number(text);
    return Number.isNaN(numericValue) ? text : numericValue;
  }

  return text;
}

function normalizeAlliance(value) {
  const normalized = normalizeHeader(value);
  if (normalized.startsWith("red")) return "red";
  if (normalized.startsWith("blue")) return "blue";
  return String(value || "").trim().toLowerCase();
}

function normalizeStation(value) {
  const text = String(value || "").trim();
  const match = text.match(/[123]/);
  return match ? match[0] : text;
}

function slugifyAnswerKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildImportRows(csvRows) {
  if (csvRows.length < 2) {
    return { rows: [], skipped: 0 };
  }

  const headers = csvRows[0].map((header) => String(header || "").trim());
  const lookup = questionLookup();
  const columnTypes = headers.map((header) => classifyColumn(header, lookup));
  const rows = [];
  let skipped = 0;

  csvRows.slice(1).forEach((values) => {
    const submission = {
      event_code: "",
      match_number: "",
      team_number: "",
      scout_name: "",
      scout_email: "",
      alliance: "",
      station: "",
      starting_location: "",
      notes: "",
      device_created_at: "",
      answers: {},
    };

    columnTypes.forEach((column, index) => {
      const rawValue = values[index] ?? "";
      if (!String(rawValue).trim()) return;

      if (column.kind === "field") {
        if (column.field === "answers") {
          submission.answers = { ...submission.answers, ...parseAnswersCell(rawValue) };
          return;
        }
        submission[column.field] = rawValue;
        return;
      }

      if (column.kind === "question") {
        submission.answers[column.question.id] = coerceAnswerValue(rawValue, column.question);
        return;
      }

      const fallbackKey = slugifyAnswerKey(headers[index]);
      if (fallbackKey) {
        submission.answers[fallbackKey] = String(rawValue).trim();
      }
    });

    if (!submission.team_number && !submission.match_number && !submission.event_code) {
      skipped += 1;
      return;
    }

    rows.push({
      event_code: String(submission.event_code || "Imported").trim(),
      match_number: String(submission.match_number || "Unknown").trim(),
      team_number: String(submission.team_number || "Unknown").trim(),
      scout_name: String(submission.scout_name || "Imported").trim(),
      scout_email: String(submission.scout_email || state.user.email || "imported@3181scouting.app").trim(),
      scout_uid: state.user.id,
      alliance: normalizeAlliance(submission.alliance || ""),
      station: normalizeStation(submission.station || ""),
      starting_location: String(submission.starting_location || "").trim(),
      notes: String(submission.notes || "").trim(),
      answers: submission.answers,
      device_created_at: String(submission.device_created_at || "").trim() || new Date().toISOString(),
    });
  });

  return { rows, skipped };
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function importCsvFile(file) {
  if (!file) return;

  setMessage(els.dataStatus, `Importing ${file.name}...`);
  const text = await file.text();
  const csvRows = parseCsv(text);
  const { rows, skipped } = buildImportRows(csvRows);

  if (!rows.length) {
    setMessage(els.dataStatus, "No importable rows found in that CSV.", true);
    return;
  }

  const chunks = chunkArray(rows, 100);
  for (const chunk of chunks) {
    const { error } = await supabase.from("submissions").insert(chunk);
    if (error) {
      setMessage(els.dataStatus, `Could not import CSV: ${error.message}`, true);
      return;
    }
  }

  setMessage(
    els.dataStatus,
    `Imported ${rows.length} row${rows.length === 1 ? "" : "s"}${skipped ? `, skipped ${skipped}` : ""}.`,
  );
  await loadSubmissions();
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
    .select("id, label, type, question_order")
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
        type: question.type,
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
    state.user = await requireAdmin();
    if (!state.user) return;

    els.exportButton.addEventListener("click", exportCsv);
    els.importButton.addEventListener("click", () => {
      els.importFileInput.click();
    });
    els.importFileInput.addEventListener("change", async () => {
      const [file] = els.importFileInput.files || [];
      await importCsvFile(file);
      els.importFileInput.value = "";
    });
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
