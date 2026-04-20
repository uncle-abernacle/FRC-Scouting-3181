import { supabase, isSupabaseConfigured } from "./supabase.js";
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
      id,
      label,
      type: els.questionType.value,
      phase: els.questionPhase.value,
      question_order: Number(els.questionOrder.value || 0),
      required: els.questionRequired.value === "true",
      options: els.questionOptions.value
        .split(",")
        .map((option) => option.trim())
        .filter(Boolean),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("questions").upsert(question);
    if (error) {
      setMessage(els.questionStatus, error.message, true);
      return;
    }

    resetQuestionEditor();
    setMessage(els.questionStatus, "Question saved.");
    await loadQuestions();
  });

  els.adminQuestionList.addEventListener("click", async (event) => {
    const editId = event.target.dataset.edit;
    const deleteId = event.target.dataset.delete;
    if (editId) {
      editQuestion(editId);
    }
    if (deleteId && confirm("Delete this question?")) {
      const { error } = await supabase.from("questions").delete().eq("id", deleteId);
      if (error) {
        setMessage(els.questionStatus, error.message, true);
      }
    }
  });
}

async function loadQuestions() {
  setStatus("Syncing", "");
  const { data, error } = await supabase.from("questions").select("*").order("question_order", { ascending: true });

  if (error) {
    console.warn(error);
    renderAdminQuestions();
    setStatus("Admin blocked", "offline");
    return;
  }

  if (data?.length) {
    state.questions = data.map(fromQuestionRow);
  }

  renderAdminQuestions();
  setStatus("Online", "online");
}

function subscribeToQuestions() {
  supabase
    .channel("questions-admin")
    .on("postgres_changes", { event: "*", schema: "public", table: "questions" }, loadQuestions)
    .subscribe();
}

function fromQuestionRow(row) {
  return {
    id: row.id,
    label: row.label,
    type: row.type,
    phase: row.phase,
    order: row.question_order,
    required: row.required,
    options: row.options || [],
  };
}

if (!isSupabaseConfigured) {
  setStatus("Needs config", "offline");
} else if (await requireAdmin()) {
  bindEvents();
  resetQuestionEditor();
  renderAdminQuestions();
  await loadQuestions();
  subscribeToQuestions();
}
