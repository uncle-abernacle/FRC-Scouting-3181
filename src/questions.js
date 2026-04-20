export const defaultQuestions = [
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

export function sortQuestions(questions) {
  return [...questions].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}
