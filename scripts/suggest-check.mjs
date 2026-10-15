// Feeds hand-written BAD model output through the validator and asserts every bad
// proposal is dropped or converted to UNCLEAR. No network, no DB. Run: `npm run check:suggest`
import assert from "node:assert/strict";
import { register } from "node:module";

// lib/ uses extensionless relative imports (bundler style); let Node retry them with ".ts".
register(
  "data:text/javascript," +
    encodeURIComponent(
      `export async function resolve(s, c, next) {
        try { return await next(s, c); }
        catch (e) { if (e.code === "ERR_MODULE_NOT_FOUND" && s.startsWith(".")) return next(s + ".ts", c); throw e; }
      }`,
    ),
);
const { validateOutput, MAX_PROPOSALS } = await import("../lib/suggest/validate.ts");
const { LlmError } = await import("../lib/llm/types.ts");

const sources = [
  { label: "Hale Capital office", content: "…" },
  { label: "Planner notes", content: "…" },
];
const RICHARD = "11111111-1111-4111-8111-111111111111";
const JAMES = "22222222-2222-4222-8222-222222222222";
const guests = [
  { id: RICHARD, name: "Richard Hale", ticketType: "VIP", note: "CEO, Hale Capital", checkedInAt: null },
  { id: JAMES, name: "James Whitfield", ticketType: "General", note: null, checkedInAt: "2026-10-15T18:00:00Z" },
];

const bad = {
  proposals: [
    { op: "DELETE_EVERYONE", source_index: 0, quote: "x" }, // unknown op → discarded
    { op: "REMOVE", source_index: 0, quote: "x", target_id: "99999999-9999-4999-8999-999999999999" }, // invented id
    { op: "REMOVE", source_index: 0, quote: "x" }, // missing target
    { op: "UPDATE_NOTE", source_index: 0, quote: "x", target_id: "not-even-a-uuid", note: "n" }, // invented id
    { op: "ADD", source_index: 0, quote: "x", name: "   " }, // empty name
    { op: "ADD", source_index: 0, quote: "x", name: "x".repeat(101) }, // overlong name
    { op: "ADD", source_index: 7, quote: "x", name: "Ghost" }, // source doesn't exist → discarded
    { op: "UPDATE_NOTE", source_index: 0, quote: "x", target_id: RICHARD }, // no note → discarded
    { op: "ADD", source_index: 0, name: 42 }, // wrong type → discarded
    "just a string", // not an object → discarded
    { op: "REMOVE", source_index: 1, quote: "Drop James", target_id: JAMES }, // valid, flagged
    { op: "ADD", source_index: 0, quote: "x", name: "richard hale" }, // valid, NAME_EXISTS
  ],
};

const r = validateOutput(bad, sources, guests);
assert.equal(r.discarded, 5);
assert.equal(r.truncated, false);
assert.deepEqual(
  r.proposals.map((p) => p.op),
  ["UNCLEAR", "UNCLEAR", "UNCLEAR", "UNCLEAR", "UNCLEAR", "REMOVE", "ADD"],
);
for (const p of r.proposals.slice(0, 3)) assert.equal(p.question, "Couldn't match this to a guest on the list");
assert.ok(r.proposals.slice(0, 5).every((p) => !p.target && p.flags.length === 0));
assert.equal(r.proposals[5].target.name, "James Whitfield");
assert.deepEqual(r.proposals[5].flags, ["ALREADY_CHECKED_IN"]);
assert.equal(r.proposals[5].sourceLabel, "Planner notes");
assert.deepEqual(r.proposals[6].flags, ["NAME_EXISTS"]);

// Two proposals on the same guest → both flagged
const twice = validateOutput(
  {
    proposals: [
      { op: "REMOVE", target_id: RICHARD },
      { op: "UPDATE_NOTE", target_id: RICHARD, note: "n" },
    ],
  },
  sources,
  guests,
);
assert.ok(twice.proposals.every((p) => p.flags.includes("SAME_TARGET_TWICE")));

// Over the cap → first 30 kept, notice set
const many = validateOutput(
  { proposals: Array.from({ length: 40 }, (_, i) => ({ op: "ADD", name: `Guest ${i}` })) },
  sources,
  guests,
);
assert.equal(many.proposals.length, MAX_PROPOSALS);
assert.equal(many.truncated, true);

// Output that fails validation entirely → bad_output error, nothing proposed
for (const junk of [null, "text", { proposals: "nope" }, { changes: [] }]) {
  assert.throws(() => validateOutput(junk, sources, guests), (e) => e instanceof LlmError && e.kind === "bad_output");
}

console.log("check:suggest OK — bad proposals dropped or converted to UNCLEAR; flags and caps hold");
