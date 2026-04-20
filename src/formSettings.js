export const defaultFormSettings = {
  steps: {
    prematch: { tab: "Prematch", eyebrow: "Before the match", title: "Setup" },
    auto: { tab: "Auto", eyebrow: "Autonomous", title: "Auto" },
    teleop: { tab: "Teleop", eyebrow: "Driver control", title: "Teleop" },
    endgame: { tab: "Endgame", eyebrow: "Final stretch", title: "Endgame" },
    review: { tab: "Review", eyebrow: "Submit", title: "Review notes" },
  },
  fields: {
    eventCode: { label: "Event", placeholder: "2026miket", required: true },
    matchNumber: { label: "Match", placeholder: "12", required: true },
    teamNumber: { label: "Team", placeholder: "3181", required: true },
    scoutName: { label: "Scout", placeholder: "Your name", required: true },
    alliance: { label: "Alliance", required: true, options: ["Red", "Blue"] },
    station: { label: "Robot position", required: true, options: ["1", "2", "3"] },
    startingLocation: {
      label: "Starting location",
      required: false,
      options: ["Left", "Center", "Right", "Source side", "Scoring side"],
    },
    preloadFuel: { label: "Preload game pieces", placeholder: "0", required: false },
    notes: { label: "Extra notes", placeholder: "Defense, driver skill, weird moments..." },
  },
};

export function mergeFormSettings(settings = {}) {
  return {
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
}
