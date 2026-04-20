import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { requireAdmin } from "./auth.js";
import { defaultQuestions, sortQuestions } from "./questions.js";
import { emptyState, escapeHtml, setMessage, setStatus } from "./ui.js";

const state = {
  questions: defaultQuestions,
};

const els = {
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
};

function sortedQuestions() {
  return sortQuestions(state.questions);
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

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

function bindEvents() {
  els.resetQuestionButton.addEventListener("click", resetQuestionEditor);

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

function subscribeToQuestions() {
  setStatus("Syncing", "");
  onSnapshot(
    query(collection(db, "questions"), orderBy("order", "asc")),
    (snapshot) => {
      if (!snapshot.empty) {
        state.questions = snapshot.docs.map((questionDoc) => ({ id: questionDoc.id, ...questionDoc.data() }));
      }
      renderAdminQuestions();
      setStatus("Online", "online");
    },
    (error) => {
      console.warn(error);
      renderAdminQuestions();
      setStatus("Admin blocked", "offline");
    },
  );
}

if (await requireAdmin()) {
  bindEvents();
  resetQuestionEditor();
  renderAdminQuestions();
  subscribeToQuestions();
}
