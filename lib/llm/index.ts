// Server only. Picks the LLM adapter from LLM_PROVIDER. Adding a provider = one file in
// providers/ + one case here.
import { fixtureProvider } from "./providers/fixture";
import { geminiProvider } from "./providers/gemini";
import { LlmError, type LlmProvider } from "./types";

export { LlmError, type LlmProvider, type StructuredRequest, type LlmErrorKind } from "./types";

export function getLlmProvider(): LlmProvider {
  const name = process.env.LLM_PROVIDER ?? "";
  switch (name) {
    case "fixture":
      return fixtureProvider;
    case "gemini":
      return geminiProvider();
    default:
      throw new LlmError("unavailable", `LLM_PROVIDER "${name}" is not configured`);
  }
}
