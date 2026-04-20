import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getAnalytics, isSupported as analyticsSupported } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCH5Z_bdX9Y-UjFnHtgtnYPpYp9sCZJboc",
  authDomain: "frc-scouting-3181.firebaseapp.com",
  projectId: "frc-scouting-3181",
  storageBucket: "frc-scouting-3181.firebasestorage.app",
  messagingSenderId: "893271056645",
  appId: "1:893271056645:web:d19a8dba3962fcb548976c",
  measurementId: "G-1TB1M80Y5G",
};

const defaultQuestions = [
  {
    id: "auto-leave",
    label: "Left starting zone",
    type: "toggle",
    phase: "auto",
    order: 10,
    required: false,
    options: [],
  },
  {
    id: "auto-score",
    label: "Auto game pieces scored",
    type: "counter",
    phase: "auto",
    order: 20,
    required: false,
    options: [],
  },
  {
    id: "teleop-score",
    label: "Teleop game pieces scored",
    type: "counter",
    phase: "teleop",
    order: 30,
    required: false,
    options: [],
  },
  {
    id: "defense",
    label: "Defense quality",
    type: "select",
    phase: "overall",
    order: 40,
    required: false,
    options: ["None", "Light", "Strong", "Lockdown"],
  },
  {
    id: "endgame",
    label: "Endgame result",
    type: "select",
    phase: "endgame",
    order: 50,
    required: false,
    options: ["None", "Parked", "Climbed", "Failed attempt"],
  },
];

const app = initializeApp(firebaseConfig);
analyticsSupported().then((supported) => {
  if (supported) {
    getAnalytics(app);
  }
});

const db = getFirestore(app);
const auth = getAuth(app);

const state = {
  questions: defaultQuestions,
  submissions: [],
  user: null,
};

const els = {
  connectionStatus: document.querySelector("#connectionStatus"),
  tabs: document.querySelectorAll("[data-view-target]"),
  views: document.querySelectorAll(".view"),
  scoutForm: document.querySelector("#scoutForm"),
  questionStack: document.querySelector("#questionStack"),
  submitStatus: document.querySelector("#submitStatus"),
  clearDraftButton: document.querySelector("#clearDraftButton"),
  loginForm: document.querySelector("#loginForm"),
  signOutButton: document.querySelector("#signOutButton"),
  adminPanel: document.querySelector("#adminPanel"),
  authStatus: document.querySelector("#authStatus"),
  questionForm: document.querySelector("#questionForm"),
  questionId: document.querySelector("#questionId"),
  questionLabel: document.querySelector("#questionLabel"),
  questionType: document.querySelector("#questionType"),
  questionPhase: document.querySelector("#questionPhase"),
  questionOrder: document.querySelector("#questionOrder"),
  questionRequired: document.querySelector("#questionRequired"),
  questionOptions: document.querySelector("#questionOptions"),
  questionStatus: document.querySelector("#questionStatus"),
  resetQuestionButton: document.querySelector("#resetQuestionButton"),
  adminQuestionList: document.querySelector("#adminQuestionList"),
  submissionList: document.querySelector("#submissionList"),
  exportButton: document.querySelector("#exportButton"),
  emptyStateTemplate: document.querySelector("#emptyStateTemplate"),
};

function setStatus(text, mode = "") {
  els.connectionStatus.textContent = text;
  els.connectionStatus.className = `status-pill ${mode}`.trim();
}

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function showView(viewId) {
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.viewTarget === viewId));
  els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
}

function emptyState(label = "No items yet", detail = "Once Firebase has data, it will appear here.") {
  const node = els.emptyStateTemplate.content.cloneNode(true);
  node.querySelector("strong").textContent = label;
  node.querySelector("span").textContent = detail;
  return node;
}

function sortedQuestions() {
  return [...state.questions].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function renderQuestions() {
  const questions = sortedQuestions();
  els.questionStack.innerHTML = "";

  if (!questions.length) {
    els.questionStack.append(emptyState("No questions configured", "Sign in as admin to add your first scouting question."));
    return;
  }

  questions.forEach((question) => {
    const card = document.createElement("div");
    card.className = "question-card";
    card.dataset.phase = question.phase || "overall";

    const title = document.createElement("label");
    title.className = "question-title";
    title.textContent = `${question.phase || "overall"} / ${question.label}`;
    card.append(title);

    card.append(buildQuestionInput(question));
    els.questionStack.append(card);
  });
}

function buildQuestionInput(question) {
  const name = `question-${question.id}`;
  const required = Boolean(question.required);

  if (question.type === "counter") {
    const wrap = document.createElement("div");
    wrap.className = "stepper";
    const minus = document.createElement("button");
    const plus = document.createElement("button");
    const value = document.createElement("input");
    const visual = document.createElement("div");

    minus.type = "button";
    plus.type = "button";
    minus.textContent = "-";
    plus.textContent = "+";
    value.type = "hidden";
    value.name = name;
    value.value = "0";
    value.dataset.questionId = question.id;
    visual.className = "stepper-value";
    visual.textContent = "0";

    minus.addEventListener("click", () => {
      value.value = String(Math.max(0, Number(value.value) - 1));
      visual.textContent = value.value;
      saveDraft();
    });
    plus.addEventListener("click", () => {
      value.value = String(Number(value.value) + 1);
      visual.textContent = value.value;
      saveDraft();
    });

    wrap.append(minus, visual, plus, value);
    return wrap;
  }

  if (question.type === "toggle") {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const track = document.createElement("span");

    label.className = "toggle-field";
    input.type = "checkbox";
    input.name = name;
    input.dataset.questionId = question.id;
    track.className = "toggle-track";

    label.append(input, track);
    return label;
  }

  if (question.type === "select") {
    const select = document.createElement("select");
    select.name = name;
    select.required = required;
    select.dataset.questionId = question.id;
    select.append(new Option("Choose", ""));
    (question.options || []).forEach((option) => select.append(new Option(option, option)));
    return select;
  }

  if (question.type === "number") {
    const input = document.createElement("input");
    input.name = name;
    input.type = "number";
    input.inputMode = "numeric";
    input.required = required;
    input.dataset.questionId = question.id;
    return input;
  }

  const textarea = document.createElement("textarea");
  textarea.name = name;
  textarea.rows = 3;
  textarea.required = required;
  textarea.dataset.questionId = question.id;
  return textarea;
}

function renderAdminQuestions() {
  const questions = sortedQuestions();
  els.adminQuestionList.innerHTML = "";

  if (!questions.length) {
    els.adminQuestionList.append(emptyState("No questions yet", "Add one above and it will sync to scouts."));
    return;
  }

  questions.forEach((question) => {
    const item = document.createElement("article");
    item.className = "admin-item";
    item.innerHTML = `
      <div class="item-topline">
        <div>
          <strong>${escapeHtml(question.label)}</strong>
          <div class="meta">${escapeHtml(question.phase)} / ${escapeHtml(question.type)} / order ${Number(question.order || 0)}</div>
        </div>
      </div>
      <div class="item-actions">
        <button class="small-button" type="button" data-edit="${question.id}">Edit</button>
        <button class="small-button danger" type="button" data-delete="${question.id}">Delete</button>
      </div>
    `;
    els.adminQuestionList.append(item);
  });
}

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
        </div>
      </div>
      <p class="meta">${escapeHtml(submission.notes || "No notes")}</p>
    `;
    els.submissionList.append(item);
  });
}

function collectAnswers(formData) {
  return sortedQuestions().reduce((answers, question) => {
    const key = `question-${question.id}`;
    const field = els.scoutForm.querySelector(`[name="${CSS.escape(key)}"]`);
    if (!field) return answers;

    if (question.type === "toggle") {
      answers[question.id] = field.checked;
    } else if (question.type === "counter" || question.type === "number") {
      answers[question.id] = Number(formData.get(key) || 0);
    } else {
      answers[question.id] = formData.get(key) || "";
    }
    return answers;
  }, {});
}

function getDraft() {
  try {
    return JSON.parse(localStorage.getItem("scoutDraft3181") || "{}");
  } catch {
    return {};
  }
}

function saveDraft() {
  const formData = new FormData(els.scoutForm);
  const draft = Object.fromEntries(formData.entries());
  els.scoutForm.querySelectorAll("input[type='checkbox']").forEach((field) => {
    draft[field.name] = field.checked;
  });
  localStorage.setItem("scoutDraft3181", JSON.stringify(draft));
}

function restoreDraft() {
  const draft = getDraft();
  Object.entries(draft).forEach(([key, value]) => {
    const field = els.scoutForm.elements[key];
    if (!field) return;

    if (field.type === "checkbox") {
      field.checked = Boolean(value);
      return;
    }

    field.value = value;
    const stepper = field.closest(".stepper");
    if (stepper) {
      stepper.querySelector(".stepper-value").textContent = value;
    }
  });
}

function resetQuestionEditor() {
  els.questionId.value = "";
  els.questionLabel.value = "";
  els.questionType.value = "counter";
  els.questionPhase.value = "auto";
  els.questionOrder.value = String((sortedQuestions().at(-1)?.order || 0) + 10);
  els.questionRequired.value = "false";
  els.questionOptions.value = "";
}

function editQuestion(id) {
  const question = state.questions.find((item) => item.id === id);
  if (!question) return;
  els.questionId.value = question.id;
  els.questionLabel.value = question.label || "";
  els.questionType.value = question.type || "text";
  els.questionPhase.value = question.phase || "overall";
  els.questionOrder.value = Number(question.order || 0);
  els.questionRequired.value = String(Boolean(question.required));
  els.questionOptions.value = (question.options || []).join(", ");
  window.scrollTo({ top: els.questionForm.offsetTop - 16, behavior: "smooth" });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[char];
  });
}

function toCsvValue(value) {
  const text = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const rows = [
    ["eventCode", "matchNumber", "teamNumber", "scoutName", "alliance", "station", "notes", "answers"],
    ...state.submissions.map((submission) => [
      submission.eventCode,
      submission.matchNumber,
      submission.teamNumber,
      submission.scoutName,
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

function bindEvents() {
  els.tabs.forEach((tab) => tab.addEventListener("click", () => showView(tab.dataset.viewTarget)));
  els.scoutForm.addEventListener("input", saveDraft);
  els.scoutForm.addEventListener("change", saveDraft);

  els.clearDraftButton.addEventListener("click", () => {
    localStorage.removeItem("scoutDraft3181");
    els.scoutForm.reset();
    renderQuestions();
    setMessage(els.submitStatus, "Draft cleared.");
  });

  els.scoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(els.submitStatus, "Submitting...");
    const formData = new FormData(els.scoutForm);
    const submission = {
      eventCode: formData.get("eventCode"),
      matchNumber: formData.get("matchNumber"),
      teamNumber: formData.get("teamNumber"),
      scoutName: formData.get("scoutName"),
      alliance: formData.get("alliance"),
      station: formData.get("station"),
      notes: formData.get("notes"),
      answers: collectAnswers(formData),
      createdAt: serverTimestamp(),
      deviceCreatedAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, "submissions"), submission);
      localStorage.removeItem("scoutDraft3181");
      els.scoutForm.reset();
      renderQuestions();
      setMessage(els.submitStatus, "Submitted. Nice work.");
    } catch (error) {
      setMessage(els.submitStatus, `Could not submit: ${error.message}`, true);
    }
  });

  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(els.authStatus, "Signing in...");
    try {
      await signInWithEmailAndPassword(auth, els.adminEmail.value, els.adminPassword.value);
      setMessage(els.authStatus, "Signed in.");
    } catch (error) {
      setMessage(els.authStatus, error.message, true);
    }
  });

  els.signOutButton.addEventListener("click", () => signOut(auth));
  els.resetQuestionButton.addEventListener("click", resetQuestionEditor);
  els.exportButton.addEventListener("click", exportCsv);

  els.questionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(els.questionStatus, "Saving...");
    const label = els.questionLabel.value.trim();
    const id = els.questionId.value || slugify(label);
    const question = {
      label,
      type: els.questionType.value,
      phase: els.questionPhase.value,
      order: Number(els.questionOrder.value || 0),
      required: els.questionRequired.value === "true",
      options: els.questionOptions.value
        .split(",")
        .map((option) => option.trim())
        .filter(Boolean),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "questions", id), question, { merge: true });
      resetQuestionEditor();
      setMessage(els.questionStatus, "Question saved.");
    } catch (error) {
      setMessage(els.questionStatus, error.message, true);
    }
  });

  els.adminQuestionList.addEventListener("click", async (event) => {
    const editId = event.target.dataset.edit;
    const deleteId = event.target.dataset.delete;
    if (editId) {
      editQuestion(editId);
    }
    if (deleteId && confirm("Delete this question?")) {
      await deleteDoc(doc(db, "questions", deleteId));
    }
  });
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

function subscribeToFirebase() {
  setStatus("Syncing", "");

  onSnapshot(
    query(collection(db, "questions"), orderBy("order", "asc")),
    (snapshot) => {
      if (!snapshot.empty) {
        state.questions = snapshot.docs.map((questionDoc) => ({ id: questionDoc.id, ...questionDoc.data() }));
      }
      renderQuestions();
      renderAdminQuestions();
      restoreDraft();
      setStatus("Online", "online");
    },
    (error) => {
      console.warn(error);
      renderQuestions();
      renderAdminQuestions();
      restoreDraft();
      setStatus("Offline rules", "offline");
    },
  );

  onSnapshot(
    query(collection(db, "submissions"), orderBy("createdAt", "desc"), limit(30)),
    (snapshot) => {
      state.submissions = snapshot.docs.map((submissionDoc) => ({ id: submissionDoc.id, ...submissionDoc.data() }));
      renderSubmissions();
    },
    (error) => {
      console.warn(error);
      renderSubmissions();
    },
  );
}

function subscribeToAuth() {
  onAuthStateChanged(auth, (user) => {
    state.user = user;
    els.adminPanel.classList.toggle("hidden", !user);
    els.signOutButton.classList.toggle("hidden", !user);
    els.loginForm.classList.toggle("hidden", Boolean(user));
    if (user) {
      setMessage(els.authStatus, `Signed in as ${user.email}`);
    }
  });
}

bindEvents();
renderQuestions();
renderAdminQuestions();
renderSubmissions();
resetQuestionEditor();
subscribeToAuth();
subscribeToFirebase();
