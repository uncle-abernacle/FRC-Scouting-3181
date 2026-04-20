import { supabase, isSupabaseConfigured } from "./supabase.js";
import { requireAdmin } from "./auth.js";
import { defaultFormSettings, mergeFormSettings } from "./formSettings.js";
import { defaultQuestions, sortQuestions } from "./questions.js";
import { emptyState, escapeHtml, setMessage, setStatus } from "./ui.js";

const state = {
  questions: defaultQuestions,
  templates: [],
  formSettings: defaultFormSettings,
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
  templateName: document.querySelector("#templateName"),
  createTemplateButton: document.querySelector("#createTemplateButton"),
  templateTabs: document.querySelector("#templateTabs"),
  formSettingsForm: document.querySelector("#formSettingsForm"),
  resetSettingsButton: document.querySelector("#resetSettingsButton"),
  adminQuestionList: document.querySelector("#adminQuestionList"),
};

const settingsInputs = {
  stepPrematchTab: document.querySelector("#stepPrematchTab"),
  stepPrematchTitle: document.querySelector("#stepPrematchTitle"),
  stepAutoTab: document.querySelector("#stepAutoTab"),
  stepAutoTitle: document.querySelector("#stepAutoTitle"),
  stepTeleopTab: document.querySelector("#stepTeleopTab"),
  stepTeleopTitle: document.querySelector("#stepTeleopTitle"),
  stepEndgameTab: document.querySelector("#stepEndgameTab"),
  stepEndgameTitle: document.querySelector("#stepEndgameTitle"),
  stepReviewTab: document.querySelector("#stepReviewTab"),
  stepReviewTitle: document.querySelector("#stepReviewTitle"),
  fieldEventCodeLabel: document.querySelector("#fieldEventCodeLabel"),
  fieldMatchNumberLabel: document.querySelector("#fieldMatchNumberLabel"),
  fieldTeamNumberLabel: document.querySelector("#fieldTeamNumberLabel"),
  fieldScoutNameLabel: document.querySelector("#fieldScoutNameLabel"),
  fieldAllianceOptions: document.querySelector("#fieldAllianceOptions"),
  fieldStationOptions: document.querySelector("#fieldStationOptions"),
  fieldStartingLocationOptions: document.querySelector("#fieldStartingLocationOptions"),
  fieldPreloadFuelLabel: document.querySelector("#fieldPreloadFuelLabel"),
  fieldNotesLabel: document.querySelector("#fieldNotesLabel"),
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

function renderTemplates() {
  els.templateTabs.innerHTML = "";

  if (!state.templates.length) {
    els.templateTabs.append(emptyState("No templates saved", "Create a template from the current questions."));
    return;
  }

  state.templates.forEach((template) => {
    const tab = document.createElement("button");
    tab.className = "template-tab";
    tab.type = "button";
    tab.dataset.templateId = template.id;
    tab.textContent = template.name;
    els.templateTabs.append(tab);
  });
}

function renderFormSettings() {
  const settings = mergeFormSettings(state.formSettings);
  settingsInputs.stepPrematchTab.value = settings.steps.prematch.tab;
  settingsInputs.stepPrematchTitle.value = settings.steps.prematch.title;
  settingsInputs.stepAutoTab.value = settings.steps.auto.tab;
  settingsInputs.stepAutoTitle.value = settings.steps.auto.title;
  settingsInputs.stepTeleopTab.value = settings.steps.teleop.tab;
  settingsInputs.stepTeleopTitle.value = settings.steps.teleop.title;
  settingsInputs.stepEndgameTab.value = settings.steps.endgame.tab;
  settingsInputs.stepEndgameTitle.value = settings.steps.endgame.title;
  settingsInputs.stepReviewTab.value = settings.steps.review.tab;
  settingsInputs.stepReviewTitle.value = settings.steps.review.title;
  settingsInputs.fieldEventCodeLabel.value = settings.fields.eventCode.label;
  settingsInputs.fieldMatchNumberLabel.value = settings.fields.matchNumber.label;
  settingsInputs.fieldTeamNumberLabel.value = settings.fields.teamNumber.label;
  settingsInputs.fieldScoutNameLabel.value = settings.fields.scoutName.label;
  settingsInputs.fieldAllianceOptions.value = settings.fields.alliance.options.join(", ");
  settingsInputs.fieldStationOptions.value = settings.fields.station.options.join(", ");
  settingsInputs.fieldStartingLocationOptions.value = settings.fields.startingLocation.options.join(", ");
  settingsInputs.fieldPreloadFuelLabel.value = settings.fields.preloadFuel.label;
  settingsInputs.fieldNotesLabel.value = settings.fields.notes.label;
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
  els.createTemplateButton.addEventListener("click", createTemplate);
  els.formSettingsForm.addEventListener("submit", saveFormSettings);
  els.resetSettingsButton.addEventListener("click", () => {
    state.formSettings = defaultFormSettings;
    renderFormSettings();
  });
  els.templateTabs.addEventListener("click", (event) => {
    const templateId = event.target.dataset.templateId;
    if (templateId) {
      loadTemplate(templateId);
    }
  });

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

async function createTemplate() {
  const name = els.templateName.value.trim();
  if (!name) {
    setMessage(els.questionStatus, "Name the template first.", true);
    return;
  }

  const questions = sortedQuestions().map((question) => ({
    id: question.id,
    label: question.label,
    type: question.type,
    phase: question.phase,
    order: Number(question.order || 0),
    required: Boolean(question.required),
    options: question.options || [],
  }));

  setMessage(els.questionStatus, "Creating template...");
  const { error } = await supabase.from("question_templates").upsert(
    {
      name,
      questions,
      settings: state.formSettings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "name" },
  );

  if (error) {
    setMessage(els.questionStatus, error.message, true);
    return;
  }

  els.templateName.value = "";
  setMessage(els.questionStatus, "Template saved.");
  await loadTemplates();
}

async function loadTemplate(templateId) {
  const template = state.templates.find((item) => item.id === templateId);
  if (!template) return;

  if (!confirm(`Load "${template.name}" into the live scouting form? This replaces the current live questions.`)) {
    return;
  }

  setMessage(els.questionStatus, `Loading ${template.name}...`);

  const { error: deleteError } = await supabase.from("questions").delete().not("id", "is", null);
  if (deleteError) {
    setMessage(els.questionStatus, deleteError.message, true);
    return;
  }

  const rows = (template.questions || []).map(toQuestionRow);
  if (rows.length) {
    const { error: insertError } = await supabase.from("questions").insert(rows);
    if (insertError) {
      setMessage(els.questionStatus, insertError.message, true);
      return;
    }
  }

  await saveSettings(template.settings || defaultFormSettings, false);
  setMessage(els.questionStatus, `${template.name} loaded into the live scouting form.`);
  await loadQuestions();
  await loadFormSettings();
}

async function saveFormSettings(event) {
  event.preventDefault();
  const settings = collectFormSettings();
  await saveSettings(settings, true);
}

async function saveSettings(settings, shouldMessage) {
  state.formSettings = mergeFormSettings(settings);
  const { error } = await supabase.from("app_settings").upsert({
    id: "scout_form",
    settings: state.formSettings,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    setMessage(els.questionStatus, error.message, true);
    return;
  }

  renderFormSettings();
  if (shouldMessage) {
    setMessage(els.questionStatus, "Form settings saved.");
  }
}

function collectFormSettings() {
  return mergeFormSettings({
    steps: {
      prematch: { tab: settingsInputs.stepPrematchTab.value, title: settingsInputs.stepPrematchTitle.value },
      auto: { tab: settingsInputs.stepAutoTab.value, title: settingsInputs.stepAutoTitle.value },
      teleop: { tab: settingsInputs.stepTeleopTab.value, title: settingsInputs.stepTeleopTitle.value },
      endgame: { tab: settingsInputs.stepEndgameTab.value, title: settingsInputs.stepEndgameTitle.value },
      review: { tab: settingsInputs.stepReviewTab.value, title: settingsInputs.stepReviewTitle.value },
    },
    fields: {
      eventCode: {
        label: settingsInputs.fieldEventCodeLabel.value,
      },
      matchNumber: { label: settingsInputs.fieldMatchNumberLabel.value },
      teamNumber: { label: settingsInputs.fieldTeamNumberLabel.value },
      scoutName: { label: settingsInputs.fieldScoutNameLabel.value },
      alliance: { options: parseOptions(settingsInputs.fieldAllianceOptions.value) },
      station: { options: parseOptions(settingsInputs.fieldStationOptions.value) },
      startingLocation: { options: parseOptions(settingsInputs.fieldStartingLocationOptions.value) },
      preloadFuel: { label: settingsInputs.fieldPreloadFuelLabel.value },
      notes: { label: settingsInputs.fieldNotesLabel.value },
    },
  });
}

function parseOptions(value) {
  return value
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);
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

  state.questions = data?.length ? data.map(fromQuestionRow) : [];

  renderAdminQuestions();
  setStatus("Online", "online");
}

async function loadTemplates() {
  const { data, error } = await supabase
    .from("question_templates")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.warn(error);
    renderTemplates();
    return;
  }

  state.templates = data || [];
  renderTemplates();
}

async function loadFormSettings() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("settings")
    .eq("id", "scout_form")
    .maybeSingle();

  if (error) {
    console.warn(error);
  }

  state.formSettings = mergeFormSettings(data?.settings || defaultFormSettings);
  renderFormSettings();
}

function subscribeToFormSettings() {
  supabase
    .channel("app-settings-admin")
    .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, loadFormSettings)
    .subscribe();
}

function subscribeToTemplates() {
  supabase
    .channel("question-templates-admin")
    .on("postgres_changes", { event: "*", schema: "public", table: "question_templates" }, loadTemplates)
    .subscribe();
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

function toQuestionRow(question) {
  return {
    id: question.id,
    label: question.label,
    type: question.type,
    phase: question.phase,
    question_order: Number(question.order || 0),
    required: Boolean(question.required),
    options: question.options || [],
    updated_at: new Date().toISOString(),
  };
}

if (!isSupabaseConfigured) {
  setStatus("Needs config", "offline");
} else if (await requireAdmin()) {
  bindEvents();
  resetQuestionEditor();
  renderAdminQuestions();
  renderTemplates();
  renderFormSettings();
  await loadQuestions();
  await loadTemplates();
  await loadFormSettings();
  subscribeToQuestions();
  subscribeToTemplates();
  subscribeToFormSettings();
}
