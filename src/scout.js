import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { setupAuthedPage } from "./auth.js";
import { defaultQuestions, sortQuestions } from "./questions.js";
import { emptyState, setMessage, setStatus } from "./ui.js";

const state = {
  questions: defaultQuestions,
  user: null,
};

const els = {
  scoutForm: document.querySelector("#scoutForm"),
  questionStack: document.querySelector("#questionStack"),
  submitStatus: document.querySelector("#submitStatus"),
  clearDraftButton: document.querySelector("#clearDraftButton"),
};

function sortedQuestions() {
  return sortQuestions(state.questions);
}

function renderQuestions() {
  const questions = sortedQuestions();
  els.questionStack.innerHTML = "";

  if (!questions.length) {
    els.questionStack.append(emptyState("No questions configured", "Ask an admin to add scouting questions."));
    return;
  }

  questions.forEach((question) => {
    const card = document.createElement("div");
    card.className = "question-card";
    card.dataset.phase = question.phase || "overall";

    const title = document.createElement("label");
    title.className = "question-title";
    title.textContent = `${question.phase || "overall"} / ${question.label}`;
    card.append(title, buildQuestionInput(question));
    els.questionStack.append(card);
  });
}

function buildQuestionInput(question) {
  const name = `question-${question.id}`;
  const required = Boolean(question.required);

  if (question.type === "counter") {
    const wrap = document.createElement("div");
    const minus = document.createElement("button");
    const plus = document.createElement("button");
    const value = document.createElement("input");
    const visual = document.createElement("div");

    wrap.className = "stepper";
    minus.type = "button";
    plus.type = "button";
    minus.textContent = "-";
    plus.textContent = "+";
    value.type = "hidden";
    value.name = name;
    value.value = "0";
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
    track.className = "toggle-track";
    label.append(input, track);
    return label;
  }

  if (question.type === "select") {
    const select = document.createElement("select");
    select.name = name;
    select.required = required;
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
    return input;
  }

  const textarea = document.createElement("textarea");
  textarea.name = name;
  textarea.rows = 3;
  textarea.required = required;
  return textarea;
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

function bindEvents() {
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
      scoutEmail: state.user.email,
      scoutUid: state.user.uid,
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
}

function subscribeToQuestions() {
  setStatus("Syncing", "");
  onSnapshot(
    query(collection(db, "questions"), orderBy("order", "asc")),
    (snapshot) => {
      if (!snapshot.empty) {
        state.questions = snapshot.docs.map((questionDoc) => ({ id: questionDoc.id, ...questionDoc.data() }));
      }
      renderQuestions();
      restoreDraft();
      setStatus("Online", "online");
    },
    (error) => {
      console.warn(error);
      renderQuestions();
      restoreDraft();
      setStatus("Offline rules", "offline");
    },
  );
}

state.user = await setupAuthedPage();
if (state.user) {
  bindEvents();
  renderQuestions();
  subscribeToQuestions();
}
