import { supabase, isSupabaseConfigured } from "./supabase.js";
import { requireAdmin } from "./auth.js";
import { defaultFormSettings, mergeFormSettings } from "./formSettings.js";
import { defaultQuestions, preset2026Questions, sortQuestions } from "./questions.js";
import { emptyState, escapeHtml, setMessage, setStatus } from "./ui.js";

const state = {
  questions: defaultQuestions,
  templates: [],
  preset2026Override: null,
  formSettings: defaultFormSettings,
  activeTemplateName: "",
};

const BLANK_TEMPLATE_ID = "__blank__";
const PRESET_2026_TEMPLATE_ID = "__preset_2026__";
const PRESET_2026_NAME = "2026 preset";
const BLANK_TEMPLATE = {
  id: BLANK_TEMPLATE_ID,
  name: "Blank preset",
  questions: [],
  settings: defaultFormSettings,
  locked: true,
};
const PRESET_2026_TEMPLATE = {
  id: PRESET_2026_TEMPLATE_ID,
  name: PRESET_2026_NAME,
  questions: preset2026Questions,
  settings: defaultFormSettings,
  locked: true,
};
const RETIRED_PRESET_2026_QUESTION_IDS = new Set([
  "teleop-preferred-scoring-location",
  "overall-fouls-penalties",
]);
const IMMUTABLE_TEMPLATES = [BLANK_TEMPLATE];

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
  updateTemplateButton: document.querySelector("#updateTemplateButton"),
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

  const templates = [BLANK_TEMPLATE, currentPreset2026Template(), ...state.templates];
  templates.forEach((template) => {
    const questions = sortQuestions(template.questions || []);
    const card = document.createElement("details");
    const isOpen = template.name === state.activeTemplateName || (!state.activeTemplateName && template.name === PRESET_2026_NAME);
    card.className = "template-dropdown";
    card.dataset.templateId = template.id;
    card.open = isOpen;
    card.innerHTML = `
      <summary class="template-dropdown-summary">
        <div>
          <strong>${escapeHtml(template.name)}</strong>
          <div class="meta">${questions.length} questions${template.locked ? " / built in" : ""}</div>
        </div>
      </summary>
      <div class="template-dropdown-body">
        <div class="item-actions">
          <button class="small-button" type="button" data-load-template-id="${template.id}">Load</button>
          ${template.locked ? "" : `<button class="small-button danger" type="button" data-deleteTemplateId="${template.id}">Delete</button>`}
        </div>
        <div class="template-question-list">
          ${
            questions.length
              ? questions
                  .map(
                    (question) => `
                      <article class="admin-item">
                        <div class="item-topline">
                          <div>
                            <strong>${escapeHtml(question.label)}</strong>
                            <div class="meta">${escapeHtml(question.phase)} / ${escapeHtml(question.type)} / order ${Number(question.order || 0)}</div>
                          </div>
                        </div>
                      </article>
                    `,
                  )
                  .join("")
              : `
                <div class="empty-state">
                  <strong>No questions</strong>
                  <span>This preset does not include any questions.</span>
                </div>
              `
          }
        </div>
      </div>
    `;
    els.templateTabs.append(card);
  });

  renderTemplateEditorState();
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

function renderTemplateEditorState() {
  const activeName = state.activeTemplateName.trim();
  const canUpdate =
    Boolean(activeName) &&
    activeName.toLowerCase() !== BLANK_TEMPLATE.name.toLowerCase() &&
    templateExists(activeName);

  els.updateTemplateButton.disabled = !canUpdate;
}

function templateExists(name) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;

  if (normalized === PRESET_2026_NAME.toLowerCase()) {
    return true;
  }

  return state.templates.some((template) => String(template.name || "").toLowerCase() === normalized);
}

function currentPreset2026Template() {
  if (!state.preset2026Override) {
    return PRESET_2026_TEMPLATE;
  }

  const mergedQuestions = mergePresetQuestions(preset2026Questions, state.preset2026Override.questions || []);
  return {
    ...PRESET_2026_TEMPLATE,
    ...state.preset2026Override,
    questions: mergedQuestions,
    settings: mergeFormSettings(state.preset2026Override.settings || defaultFormSettings),
    id: PRESET_2026_TEMPLATE_ID,
    name: PRESET_2026_NAME,
    locked: true,
  };
}

function mergePresetQuestions(baseQuestions, overrideQuestions) {
  const overrideById = new Map(
    (overrideQuestions || [])
      .filter((question) => question?.id)
      .map((question) => [question.id, question]),
  );
  const baseIds = new Set(baseQuestions.map((question) => question.id));

  return [
    ...baseQuestions.map((question) => ({ ...question, ...(overrideById.get(question.id) || {}) })),
    ...(overrideQuestions || []).filter(
      (question) => !baseIds.has(question.id) && !RETIRED_PRESET_2026_QUESTION_IDS.has(question.id),
    ),
  ];
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

function captureCurrentTemplate() {
  return {
    questions: sortedQuestions().map((question) => ({
      id: question.id,
      label: question.label,
      type: question.type,
      phase: question.phase,
      order: Number(question.order || 0),
      required: Boolean(question.required),
      options: question.options || [],
    })),
    settings: state.formSettings,
  };
}

function bindEvents() {
  els.resetQuestionButton.addEventListener("click", resetQuestionEditor);
  els.createTemplateButton.addEventListener("click", createTemplate);
  els.updateTemplateButton.addEventListener("click", updateTemplate);
  els.formSettingsForm.addEventListener("submit", saveFormSettings);
  els.resetSettingsButton.addEventListener("click", () => {
    state.formSettings = defaultFormSettings;
    renderFormSettings();
    saveSettings(defaultFormSettings, true);
  });
  els.templateName.addEventListener("input", () => {
    state.activeTemplateName = els.templateName.value.trim();
    renderTemplateEditorState();
  });
  els.templateTabs.addEventListener("click", (event) => {
    const loadTemplateId = event.target.dataset.loadTemplateId;
    if (loadTemplateId) {
      loadTemplate(loadTemplateId);
      return;
    }

    const deleteTemplateId = event.target.dataset.deleteTemplateId;
    if (deleteTemplateId) {
      deleteTemplate(deleteTemplateId);
    }
  });
  els.templateTabs.addEventListener(
    "toggle",
    (event) => {
      const dropdown = event.target;
      if (!dropdown.matches(".template-dropdown")) return;
      if (!dropdown.open) return;

      els.templateTabs.querySelectorAll(".template-dropdown[open]").forEach((item) => {
        if (item !== dropdown) {
          item.open = false;
        }
      });

      const template = resolveTemplateById(dropdown.dataset.templateId);
      if (!template) return;
      state.activeTemplateName = template.name;
      els.templateName.value = template.name;
      renderTemplateEditorState();
    },
    true,
  );

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

  const reservedTemplate = IMMUTABLE_TEMPLATES.find((template) => template.name.toLowerCase() === name.toLowerCase());
  if (reservedTemplate) {
    setMessage(els.questionStatus, `"${reservedTemplate.name}" is reserved. Pick a different preset name.`, true);
    return;
  }

  if (name.toLowerCase() === PRESET_2026_NAME.toLowerCase()) {
    setMessage(els.questionStatus, `Use "Update preset" if you want to change ${PRESET_2026_NAME}.`, true);
    return;
  }

  const { questions, settings } = captureCurrentTemplate();

  setMessage(els.questionStatus, "Creating template...");
  const { error } = await supabase.from("question_templates").upsert(
    {
      name,
      questions,
      settings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "name" },
  );

  if (error) {
    setMessage(els.questionStatus, error.message, true);
    return;
  }

  state.activeTemplateName = name;
  els.templateName.value = name;
  setMessage(els.questionStatus, "Template saved.");
  await loadTemplates();
}

async function updateTemplate() {
  const name = els.templateName.value.trim() || state.activeTemplateName.trim();
  if (!name) {
    setMessage(els.questionStatus, "Load a preset or type its name first.", true);
    return;
  }

  if (name.toLowerCase() === BLANK_TEMPLATE.name.toLowerCase()) {
    setMessage(els.questionStatus, `${BLANK_TEMPLATE.name} cannot be changed.`, true);
    return;
  }

  if (!templateExists(name)) {
    setMessage(els.questionStatus, `No preset named "${name}" exists yet. Create it first.`, true);
    return;
  }

  const { questions, settings } = captureCurrentTemplate();
  setMessage(els.questionStatus, `Updating ${name}...`);
  const { error } = await supabase.from("question_templates").upsert(
    {
      name,
      questions,
      settings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "name" },
  );

  if (error) {
    setMessage(els.questionStatus, error.message, true);
    return;
  }

  state.activeTemplateName = name;
  els.templateName.value = name;
  setMessage(els.questionStatus, `${name} updated.`);
  await loadTemplates();
}

async function loadTemplate(templateId) {
  const template = resolveTemplateById(templateId);
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
  state.activeTemplateName = template.name;
  els.templateName.value = template.name;
  setMessage(els.questionStatus, `${template.name} loaded into the live scouting form.`);
  await loadQuestions();
  await loadFormSettings();
  renderTemplates();
}

function resolveTemplateById(templateId) {
  return [BLANK_TEMPLATE, currentPreset2026Template(), ...state.templates].find((item) => item.id === templateId) || null;
}

async function deleteTemplate(templateId) {
  const template = state.templates.find((item) => item.id === templateId);
  if (!template) return;

  if (!confirm(`Delete preset "${template.name}"?`)) {
    return;
  }

  setMessage(els.questionStatus, `Deleting ${template.name}...`);
  const { error } = await supabase.from("question_templates").delete().eq("id", templateId);

  if (error) {
    setMessage(els.questionStatus, error.message, true);
    return;
  }

  if (state.activeTemplateName === template.name) {
    state.activeTemplateName = "";
    els.templateName.value = "";
  }
  setMessage(els.questionStatus, `${template.name} deleted.`);
  await loadTemplates();
}

async function saveFormSettings(event) {
  event.preventDefault();
  const settings = collectFormSettings();
  await saveSettings(settings, true);
}

async function saveSettings(settings, shouldMessage) {
  state.formSettings = mergeFormSettings(settings);
  if (shouldMessage) {
    setMessage(els.questionStatus, "Saving form settings...");
  }

  const { data, error } = await supabase.from("app_settings").upsert({
    id: "scout_form",
    settings: state.formSettings,
    updated_at: new Date().toISOString(),
  }).select("settings").single();

  if (error) {
    setMessage(els.questionStatus, formSettingsError(error), true);
    return;
  }

  state.formSettings = mergeFormSettings(data?.settings || state.formSettings);
  renderFormSettings();
  if (shouldMessage) {
    setMessage(els.questionStatus, "Form settings saved.");
  }
}

function formSettingsError(error) {
  if (error.code === "42P01" || error.message.includes("app_settings")) {
    return "Form settings table is missing. Run supabase/schema.sql in Supabase, then save again.";
  }

  if (error.code === "42501" || error.message.toLowerCase().includes("row-level security")) {
    return "Supabase blocked saving form settings. Make sure you are admin and rerun supabase/schema.sql.";
  }

  return error.message;
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

  const allTemplates = data || [];
  state.preset2026Override =
    allTemplates.find((template) => String(template.name || "").toLowerCase() === PRESET_2026_NAME.toLowerCase()) || null;
  state.templates = allTemplates.filter((template) => {
    const normalized = String(template.name || "").toLowerCase();
    return normalized !== BLANK_TEMPLATE.name.toLowerCase() && normalized !== PRESET_2026_NAME.toLowerCase();
  });
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

async function initAdminPage() {
  try {
    if (!(await requireAdmin())) return;

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
  } catch (error) {
    console.error(error);
    setStatus("Load error", "offline");
    setMessage(els.questionStatus, "Could not load admin tools. Refresh and try again.", true);
  }
}

if (!isSupabaseConfigured) {
  setStatus("Needs config", "offline");
} else {
  void initAdminPage();
}
