export const defaultFormSettings = {
  steps: {
    prematch: { tab: "Prematch", eyebrow: "Before the match", title: "Setup" },
    auto: { tab: "Auto", eyebrow: "Autonomous", title: "Auto" },
    teleop: { tab: "Teleop", eyebrow: "Driver control", title: "Teleop" },
    endgame: { tab: "Endgame", eyebrow: "Final stretch", title: "Endgame" },
    review: { tab: "Review", eyebrow: "Submit", title: "Review notes" },
  },
  fields: {
    eventCode: { label: "Event", placeholder: "", required: true },
    matchNumber: { label: "Match", placeholder: "", required: true },
    teamNumber: { label: "Team", placeholder: "", required: true },
    scoutName: { label: "Scout", placeholder: "", required: true },
    alliance: { label: "Alliance", required: true, options: ["Red", "Blue"] },
    station: { label: "Robot position", required: true, options: ["1", "2", "3"] },
    startingLocation: {
      label: "Starting location",
      required: false,
      options: ["Left", "Center", "Right", "Source side", "Scoring side"],
    },
    preloadFuel: { label: "Preload game pieces", placeholder: "", required: false },
    notes: { label: "Extra notes", placeholder: "Defense, driver skill, weird moments..." },
  },
};

export function mergeFormSettings(settings = {}) {
  const merged = {
    steps: {
      ...defaultFormSettings.steps,
      ...(settings.steps || {}),
    },
    fields: Object.fromEntries(
      Object.entries(defaultFormSettings.fields).map(([key, value]) => [
        key,
        {
          ...value,
          ...(settings.fields?.[key] || {}),
        },
      ]),
    ),
  };

  Object.entries(merged.fields).forEach(([key, field]) => {
    if (key !== "notes") {
      field.placeholder = "";
    }
  });

  return merged;
}
