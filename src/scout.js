import { supabase, isSupabaseConfigured } from "./supabase.js";
import { setupAuthedPage } from "./auth.js";
import { defaultFormSettings, mergeFormSettings } from "./formSettings.js";
import { defaultQuestions, sortQuestions } from "./questions.js";
import { emptyState, setMessage, setStatus } from "./ui.js";

const state = {
  questions: defaultQuestions,
  user: null,
  currentStep: 0,
  formSettings: defaultFormSettings,
  isSubmitting: false,
};

const steps = ["prematch", "auto", "teleop", "endgame", "review"];

const els = {
  scoutForm: document.querySelector("#scoutForm"),
  phaseStacks: document.querySelectorAll("[data-phase-stack]"),
  stepPanels: document.querySelectorAll("[data-step]"),
  progressSteps: document.querySelectorAll("[data-step-target]"),
  submitStatus: document.querySelector("#submitStatus"),
  clearDraftButton: document.querySelector("#clearDraftButton"),
  prevStepButton: document.querySelector("#prevStepButton"),
  nextStepButton: document.querySelector("#nextStepButton"),
  submitButton: document.querySelector("#submitButton"),
};

function sortedQuestions() {
  return sortQuestions(state.questions);
}

function renderQuestions() {
  const questions = sortedQuestions();
  els.phaseStacks.forEach((stack) => {
    stack.innerHTML = "";
  });

  if (!questions.length) {
    els.phaseStacks.forEach((stack) => {
      stack.append(emptyState("No questions configured", "Ask an admin to add scouting questions."));
    });
    return;
  }

  questions.forEach((question) => {
    const phase = question.phase || "overall";
    const stack = document.querySelector(`[data-phase-stack="${CSS.escape(phase)}"]`);
    if (!stack) return;

    const card = document.createElement("div");
    card.className = "question-card";
    card.dataset.phase = phase;

    const title = document.createElement("label");
    title.className = "question-title";
    title.textContent = question.label;
    card.append(title, buildQuestionInput(question));
    stack.append(card);
  });

  els.phaseStacks.forEach((stack) => {
    if (!stack.children.length) {
      stack.append(emptyState("No questions for this phase", "Admins can add questions for this part of the match."));
    }
  });
}

function applyFormSettings() {
  const settings = mergeFormSettings(state.formSettings);

  Object.entries(settings.steps).forEach(([key, step]) => {
    const progress = document.querySelector(`[data-step-target="${CSS.escape(key)}"]`);
    const panel = document.querySelector(`[data-step="${CSS.escape(key)}"]`);
    if (progress) progress.textContent = step.tab;
    if (panel) {
      const eyebrow = panel.querySelector(".eyebrow");
      const title = panel.querySelector("h3");
      if (eyebrow) eyebrow.textContent = step.eyebrow;
      if (title) title.textContent = step.title;
    }
  });

  applyFieldSetting("eventCode", settings.fields.eventCode);
  applyFieldSetting("matchNumber", settings.fields.matchNumber);
  applyFieldSetting("teamNumber", settings.fields.teamNumber);
  applyFieldSetting("scoutName", settings.fields.scoutName);
  applyFieldSetting("alliance", settings.fields.alliance);
  applyFieldSetting("station", settings.fields.station);
  applyFieldSetting("startingLocation", settings.fields.startingLocation);
  applyFieldSetting("notes", settings.fields.notes);
}

function applyFieldSetting(fieldId, setting) {
  const field = document.querySelector(`#${fieldId}`);
  if (!field || !setting) return;

  const labelText = field.closest("label")?.querySelector("span");
  if (labelText && setting.label) labelText.textContent = setting.label;

  if ("placeholder" in setting && "placeholder" in field) {
    field.placeholder = setting.placeholder || "";
  }

  if ("required" in setting) {
    field.required = Boolean(setting.required);
  }

  if (field.tagName === "SELECT" && Array.isArray(setting.options)) {
    const currentValue = field.value;
    field.innerHTML = "";
    field.append(new Option("Choose", ""));
    setting.options.forEach((option) => {
      field.append(new Option(option, option.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")));
    });
    field.value = currentValue;
  }
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
    value.dataset.required = String(required);
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
    input.required = required;
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
  draft.__step = steps[state.currentStep];
  els.scoutForm.querySelectorAll("input[type='checkbox']").forEach((field) => {
    draft[field.name] = field.checked;
  });
  localStorage.setItem("scoutDraft3181", JSON.stringify(draft));
}

function setSubmitting(isSubmitting) {
  state.isSubmitting = isSubmitting;
  els.submitButton.disabled = isSubmitting;
  els.nextStepButton.disabled = isSubmitting;
  els.prevStepButton.disabled = isSubmitting;
  els.clearDraftButton.disabled = isSubmitting;
  els.progressSteps.forEach((button) => {
    button.disabled = isSubmitting;
  });
}

function createStickyDraftAfterSubmit(formData) {
  const matchNumber = String(formData.get("matchNumber") || "").trim();

  return {
    eventCode: formData.get("eventCode") || "",
    matchNumber: incrementMatchNumber(matchNumber),
    scoutName: formData.get("scoutName") || "",
    alliance: formData.get("alliance") || "",
    station: formData.get("station") || "",
    startingLocation: formData.get("startingLocation") || "",
    __step: "prematch",
  };
}

function incrementMatchNumber(value) {
  if (!/^\d+$/.test(value)) {
    return value;
  }

  return String(Number(value) + 1);
}

function restoreDraft() {
  const draft = getDraft();
  Object.entries(draft).forEach(([key, value]) => {
    if (key === "__step") return;
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

  if (draft.__step && steps.includes(draft.__step)) {
    showStep(steps.indexOf(draft.__step));
  }
}

function bindEvents() {
  els.scoutForm.addEventListener("input", saveDraft);
  els.scoutForm.addEventListener("change", saveDraft);
  els.prevStepButton.addEventListener("click", () => showStep(state.currentStep - 1));
  els.nextStepButton.addEventListener("click", () => {
    if (state.isSubmitting) return;
    if (validateCurrentStep()) {
      showStep(state.currentStep + 1);
    }
  });
  els.progressSteps.forEach((button) => {
    button.addEventListener("click", () => {
      if (state.isSubmitting) return;
      const targetIndex = steps.indexOf(button.dataset.stepTarget);
      if (targetIndex <= state.currentStep || validateCurrentStep()) {
        showStep(targetIndex);
      }
    });
  });

  els.clearDraftButton.addEventListener("click", () => {
    if (state.isSubmitting) return;
    localStorage.removeItem("scoutDraft3181");
    localStorage.removeItem("lastSubmission3181");
    els.scoutForm.reset();
    renderQuestions();
    showStep(0);
    setMessage(els.submitStatus, "Draft cleared.");
  });

  els.scoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.isSubmitting) return;
    if (!validateAllSteps()) {
      return;
    }
    setSubmitting(true);
    setMessage(els.submitStatus, "Submitting to Supabase...");

    const formData = new FormData(els.scoutForm);
    const submission = {
      event_code: formData.get("eventCode"),
      match_number: formData.get("matchNumber"),
      team_number: formData.get("teamNumber"),
      scout_name: formData.get("scoutName"),
      scout_email: state.user.email,
      scout_uid: state.user.id,
      alliance: formData.get("alliance"),
      station: formData.get("station"),
      starting_location: formData.get("startingLocation"),
      notes: formData.get("notes"),
      answers: collectAnswers(formData),
      device_created_at: new Date().toISOString(),
    };

    try {
      const { data: submissionId, error } = await supabase.rpc("submit_scouting_submission", {
        p_event_code: submission.event_code,
        p_match_number: submission.match_number,
        p_team_number: submission.team_number,
        p_scout_name: submission.scout_name,
        p_scout_email: submission.scout_email,
        p_scout_uid: submission.scout_uid,
        p_alliance: submission.alliance,
        p_station: submission.station,
        p_starting_location: submission.starting_location,
        p_notes: submission.notes,
        p_answers: submission.answers,
        p_device_created_at: submission.device_created_at,
      });

      if (error || !submissionId) {
        setMessage(els.submitStatus, `Could not submit: ${error?.message || "Supabase did not return a submission id."}`, true);
        return;
      }

      const stickyDraft = createStickyDraftAfterSubmit(formData);
      localStorage.setItem("scoutDraft3181", JSON.stringify(stickyDraft));
      localStorage.setItem(
        "lastSubmission3181",
        JSON.stringify({
          id: submissionId,
          createdAt: new Date().toISOString(),
          teamNumber: submission.team_number,
          matchNumber: submission.match_number,
        }),
      );

      els.scoutForm.reset();
      renderQuestions();
      showStep(0, false);
      restoreDraft();
      setMessage(
        els.submitStatus,
        `Submitted Match ${submission.match_number} for Team ${submission.team_number}.`,
      );
    } finally {
      setSubmitting(false);
    }
  });
}

function showStep(index, shouldSave = true) {
  state.currentStep = Math.min(Math.max(index, 0), steps.length - 1);
  const current = steps[state.currentStep];

  els.stepPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.step === current);
  });
  els.progressSteps.forEach((button, buttonIndex) => {
    button.classList.toggle("active", button.dataset.stepTarget === current);
    button.classList.toggle("complete", buttonIndex < state.currentStep);
  });

  els.prevStepButton.classList.toggle("hidden", state.currentStep === 0);
  els.nextStepButton.classList.toggle("hidden", state.currentStep === steps.length - 1);
  els.submitButton.classList.toggle("hidden", state.currentStep !== steps.length - 1);
  if (!state.isSubmitting) {
    setMessage(els.submitStatus, "");
  }
  if (shouldSave) {
    saveDraft();
  }
}

function validateCurrentStep() {
  const panel = els.stepPanels[state.currentStep];
  if (validatePanel(panel)) return true;

  return false;
}

function validateAllSteps() {
  for (let index = 0; index < els.stepPanels.length; index += 1) {
    const panel = els.stepPanels[index];
    if (findRequiredProblem(panel)) {
      showStep(index);
      validatePanel(panel);
      return false;
    }
  }

  return true;
}

function validatePanel(panel) {
  const { emptyCounter, invalid } = findRequiredProblem(panel);
  if (emptyCounter) {
    const title = emptyCounter.closest(".question-card")?.querySelector(".question-title")?.textContent || "This required counter";
    setMessage(els.submitStatus, `${title} is required. Add at least 1.`, true);
    emptyCounter.closest(".question-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  if (!invalid) return true;

  invalid.reportValidity();
  setMessage(els.submitStatus, "Finish the required question before continuing.", true);
  return false;
}

function findRequiredProblem(panel) {
  return {
    emptyCounter: panel.querySelector("input[type='hidden'][data-required='true'][value='0']"),
    invalid: panel.querySelector("input:invalid, select:invalid, textarea:invalid"),
  };
}

async function loadQuestions() {
  setStatus("Syncing", "");
  const { data, error } = await supabase.from("questions").select("*").order("question_order", { ascending: true });

  if (error) {
    console.warn(error);
    renderQuestions();
    restoreDraft();
    setStatus("Offline rules", "offline");
    return;
  }

  state.questions = data?.length ? data.map(fromQuestionRow) : [];

  renderQuestions();
  restoreDraft();
  setStatus("Online", "online");
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
  applyFormSettings();
  restoreDraft();
}

function subscribeToQuestions() {
  supabase
    .channel("questions-scout")
    .on("postgres_changes", { event: "*", schema: "public", table: "questions" }, loadQuestions)
    .subscribe();
}

function subscribeToFormSettings() {
  supabase
    .channel("app-settings-scout")
    .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, loadFormSettings)
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
  setMessage(els.submitStatus, "Add your Supabase URL and anon key in src/supabase.js first.", true);
  applyFormSettings();
  renderQuestions();
  showStep(0);
} else {
  state.user = await setupAuthedPage();
  if (state.user) {
    bindEvents();
    applyFormSettings();
    renderQuestions();
    showStep(0);
    await loadQuestions();
    await loadFormSettings();
    subscribeToQuestions();
    subscribeToFormSettings();
  }
}
