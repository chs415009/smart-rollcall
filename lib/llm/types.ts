// Provider-neutral LLM interface. Feature code depends on this file and lib/llm/index.ts
// only — never on a provider file or a vendor SDK.

export interface StructuredRequest {
  system: string; // instructions
  user: string; // sources + guest list, already formatted
  jsonSchema: object; // shape the output must follow
  timeoutMs: number;
}

export interface LlmProvider {
  name: string; // "gemini" | "fixture" | later "anthropic", "openai", ...
  // Parsed JSON, untrusted. Providers never validate domain rules — lib/suggest/validate.ts does.
  generateStructured(req: StructuredRequest): Promise<unknown>;
}

export type LlmErrorKind = "rate_limited" | "timeout" | "bad_output" | "unavailable";

// Plain field instead of a constructor parameter property so `npm run check:suggest`
// can load this file with Node's type stripping.
export class LlmError extends Error {
  kind: LlmErrorKind;
  constructor(kind: LlmErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}
