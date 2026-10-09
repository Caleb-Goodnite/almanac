// Builds lib/db/seed-data/exercises.json from yuhonas/free-exercise-db
// (public domain, Unlicense). Usage:
//   node scripts/build-exercise-seed.mjs path/to/exercises.json
// Images are deliberately dropped: the dataset does not state a separate
// licence for them.
import { readFileSync, writeFileSync } from "node:fs";

const GROUP = {
  chest: "chest", lats: "back", "middle back": "back", "lower back": "back", traps: "back",
  shoulders: "shoulders", biceps: "biceps", triceps: "triceps", forearms: "forearms",
  quadriceps: "quads", hamstrings: "hamstrings", glutes: "glutes", calves: "calves",
  abdominals: "abs", neck: null, adductors: null, abductors: null,
};

const groups = (list) => [...new Set((list ?? []).map((m) => GROUP[m]).filter(Boolean))];

// A rough movement-pattern label from the name and muscles. It is a heuristic
// used for browsing and for the coach's summary, not for any calculation.
function pattern(e, primary) {
  const n = e.name.toLowerCase();
  if (e.category === "stretching") return "mobility";
  if (e.category === "cardio") return "cardio";
  if (e.category === "plyometrics") return "jump";
  if (/carry|farmer|yoke|walk\b/.test(n)) return "carry";
  if (/lunge|split squat|step[- ]?up/.test(n)) return "lunge";
  if (/squat|leg press|hack/.test(n)) return "squat";
  if (/deadlift|good morning|hip thrust|glute bridge|pull[- ]through|swing|hyperextension|romanian/.test(n)) return "hinge";
  if (/pull[- ]?up|chin[- ]?up|pulldown|pull-down/.test(n)) return "vertical pull";
  if (/\brow\b|rows\b|face pull/.test(n)) return "horizontal pull";
  if (/overhead|military|shoulder press|push press|arnold|handstand/.test(n)) return "vertical push";
  if (/bench|push[- ]?up|chest press|dip\b|dips\b|floor press/.test(n)) return "horizontal push";
  if (primary.includes("abs")) return "core";
  if (e.mechanic === "isolation") return "isolation";
  if (primary.includes("quads")) return "squat";
  if (primary.includes("hamstrings") || primary.includes("glutes")) return "hinge";
  if (primary.includes("chest")) return "horizontal push";
  if (primary.includes("back")) return e.force === "pull" ? "horizontal pull" : "hinge";
  if (primary.includes("shoulders")) return "vertical push";
  return "other";
}

const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const source = JSON.parse(readFileSync(process.argv[2], "utf8"));
const seen = new Set();
const out = [];
for (const e of source) {
  const s = slug(e.id ?? e.name);
  if (!s || seen.has(s)) continue;
  seen.add(s);
  const primary = groups(e.primaryMuscles);
  const secondary = groups(e.secondaryMuscles).filter((g) => !primary.includes(g));
  out.push({
    slug: s,
    name: e.name.replace(/\s+/g, " ").trim(),
    category: e.category ?? "strength",
    equipment: e.equipment ?? null,
    level: e.level ?? null,
    mechanic: e.mechanic ?? null,
    force: e.force ?? null,
    movementPattern: pattern(e, primary),
    primaryGroups: primary,
    secondaryGroups: secondary,
    instructions: (e.instructions ?? []).map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean),
  });
}
out.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(new URL("../lib/db/seed-data/exercises.json", import.meta.url), JSON.stringify(out));
const tally = {};
for (const e of out) tally[e.movementPattern] = (tally[e.movementPattern] ?? 0) + 1;
console.log(out.length, "exercises", tally);
