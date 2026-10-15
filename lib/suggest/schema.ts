// The model's output shape, twice: zod (what we accept) and JSON Schema (what we ask
// for). Hand-written — keep them in sync. Kept deliberately flat and portable: one
// `proposals` array of flat objects, `op` as a string enum, no oneOf/anyOf/$ref.
// Per-op requirements (ADD needs a name, …) are enforced in validate.ts, not here.
import { z } from "zod";

export const OPS = ["ADD", "REMOVE", "UPDATE_NOTE", "UNCLEAR"] as const;

// Top level only: individual proposals are checked one by one, so one bad proposal
// is discarded without losing the rest.
export const outputSchema = z.object({ proposals: z.array(z.unknown()) });

// Providers may send null for absent optional fields; treat null as absent.
const optStr = z.string().nullish().transform((v) => v ?? undefined);

export const proposalSchema = z.object({
  op: z.enum(OPS),
  source_index: z.number().int().nullish().transform((v) => v ?? undefined),
  quote: optStr,
  name: optStr,
  note: optStr,
  target_id: optStr,
  question: optStr,
});

export type RawProposal = z.infer<typeof proposalSchema>;

const str = (description: string) => ({ type: "string", description });

export const outputJsonSchema = {
  type: "object",
  properties: {
    proposals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          op: { type: "string", enum: [...OPS] },
          source_index: { type: "integer", description: "Index of the source message this came from" },
          quote: str("Short excerpt from that source, at most ~15 words"),
          // Order matters: Gemini emits keys in schema order, so target_id must come
          // before note or an UPDATE_NOTE can't set its note after its target.
          target_id: str("REMOVE / UPDATE_NOTE: an id copied from the guest list"),
          name: str("ADD: the new guest's name"),
          note: str("ADD: optional note. UPDATE_NOTE: required — the full new note text"),
          question: str("UNCLEAR only: what the host needs to decide. Leave unset for every other op"),
        },
        required: ["op"],
      },
    },
  },
  required: ["proposals"],
};
