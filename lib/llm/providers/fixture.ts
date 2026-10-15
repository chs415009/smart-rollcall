// Canned output for the demo messages, in the same raw shape a real model returns.
// No network: target ids are read from the guest list already in the request, so the
// output goes through exactly the same validator as a live model's.
// For building and testing only — never record the demo on this provider.
import type { LlmProvider, StructuredRequest } from "../types";

function idOf(req: StructuredRequest, name: string): string {
  // Guest list lines are JSON objects (see lib/suggest/prompt.ts): {"id":"…","name":"…",…}
  const line = req.user.split("\n").find((l) => l.includes(`"name":${JSON.stringify(name)}`));
  const match = line?.match(/"id":"([0-9a-f-]{36})"/);
  // Not on the list → an id that matches nobody, which the validator turns into UNCLEAR.
  return match?.[1] ?? "00000000-0000-4000-8000-00000000dead";
}

export const fixtureProvider: LlmProvider = {
  name: "fixture",
  async generateStructured(req) {
    return {
      proposals: [
        {
          op: "REMOVE",
          source_index: 0,
          quote: "Richard won't be able to make it on Saturday",
          target_id: idOf(req, "Richard Hale"),
        },
        {
          op: "ADD",
          source_index: 0,
          quote: "his chief of staff, Lena Moritz, to attend in his place",
          name: "Lena Moritz",
          note: "Vegetarian; attending for Richard Hale",
        },
        {
          op: "ADD",
          source_index: 1,
          quote: "is it still ok if we bring my sister Anna?",
          name: "Anna",
          note: "Guest of Mei Chen",
        },
        {
          op: "UPDATE_NOTE",
          source_index: 1,
          quote: "Daniel is gluten free now",
          target_id: idOf(req, "Daniel Chen"),
          note: "Gluten free",
        },
        {
          op: "REMOVE",
          source_index: 2,
          quote: "Drop James Whitfield, his firm pulled out of the sponsorship",
          target_id: idOf(req, "James Whitfield"),
        },
        {
          op: "UPDATE_NOTE",
          source_index: 2,
          quote: "Tom needs a seat near the stage, bad knee",
          target_id: idOf(req, "Tom Okafor"),
          note: "Spouse of Sarah Okafor; seat near the stage (bad knee)",
        },
        {
          op: "UNCLEAR",
          source_index: 2,
          quote: "Chris can't come anymore",
          question: "Which Chris can't come — Chris Morgan or Chris Delaney?",
        },
      ],
    };
  },
};
