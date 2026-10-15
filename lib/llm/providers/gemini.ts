// The only file that imports @google/genai. Server only.
// Maps every vendor error to an LlmError kind so nothing outside providers/ sees SDK types.
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { LlmError, type LlmProvider } from "../types";

export function geminiProvider(): LlmProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!apiKey || !model) throw new LlmError("unavailable", "GEMINI_API_KEY or LLM_MODEL is not set");
  const ai = new GoogleGenAI({ apiKey });

  return {
    name: "gemini",
    async generateStructured(req) {
      let text: string | undefined;
      try {
        const res = await ai.models.generateContent({
          model,
          contents: req.user,
          config: {
            systemInstruction: req.system,
            temperature: 0,
            responseMimeType: "application/json",
            responseJsonSchema: req.jsonSchema,
            // Extraction, not reasoning: lowest thinking keeps latency down on camera.
            // LOW, not MINIMAL: gemini-3.8-flash rejects MINIMAL with HTTP 400.
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            abortSignal: AbortSignal.timeout(req.timeoutMs),
          },
        });
        text = res.text;
      } catch (err) {
        throw toLlmError(err);
      }
      if (!text) throw new LlmError("bad_output", "Empty response (possibly blocked)");
      try {
        return JSON.parse(text);
      } catch {
        throw new LlmError("bad_output", "Response was not valid JSON");
      }
    },
  };
}

function toLlmError(err: unknown): LlmError {
  if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
    return new LlmError("timeout", "Gemini request timed out");
  }
  if (err instanceof ApiError) {
    if (err.status === 429 || err.message.includes("RESOURCE_EXHAUSTED")) {
      return new LlmError("rate_limited", `Gemini rate limit: ${err.message}`);
    }
    return new LlmError("unavailable", `Gemini HTTP ${err.status}: ${err.message}`);
  }
  return new LlmError("unavailable", `Gemini call failed: ${err instanceof Error ? err.message : String(err)}`);
}
