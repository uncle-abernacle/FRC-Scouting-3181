import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
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
          <strong>Team ${escapeHtml(submission.teamNumber)} / Match ${escapeHtml(submission.matchNumber)}</strong>
          <div class="meta">${escapeHtml(submission.eventCode)} / ${escapeHtml(submission.alliance)} ${escapeHtml(submission.station)} / ${answered} answers</div>
          <div class="meta">Scout: ${escapeHtml(submission.scoutName)} ${submission.scoutEmail ? `(${escapeHtml(submission.scoutEmail)})` : ""}</div>
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
    ["eventCode", "matchNumber", "teamNumber", "scoutName", "scoutEmail", "alliance", "station", "notes", "answers"],
    ...state.submissions.map((submission) => [
      submission.eventCode,
      submission.matchNumber,
      submission.teamNumber,
      submission.scoutName,
      submission.scoutEmail,
      submission.alliance,
      submission.station,
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

function subscribeToSubmissions() {
  setStatus("Syncing", "");
  onSnapshot(
    query(collection(db, "submissions"), orderBy("createdAt", "desc"), limit(60)),
    (snapshot) => {
      state.submissions = snapshot.docs.map((submissionDoc) => ({ id: submissionDoc.id, ...submissionDoc.data() }));
      renderSubmissions();
      setStatus("Online", "online");
    },
    (error) => {
      console.warn(error);
      renderSubmissions();
      setStatus("Admin blocked", "offline");
    },
  );
}

if (await requireAdmin()) {
  els.exportButton.addEventListener("click", exportCsv);
  renderSubmissions();
  subscribeToSubmissions();
}
