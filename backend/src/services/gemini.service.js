const { GoogleGenerativeAI, FunctionCallingMode } = require("@google/generative-ai");
const { assistant: config } = require("../config/env");
const ApiError = require("../utils/ApiError");
const logger = require("../config/logger");

/**
 * Gemini core (same API and model as ELIZFLOW: @google/generative-ai, gemini-2.5-flash).
 * Used only by the Super Admin back-office assistant (adminAssistant.service.js).
 *
 * A rejected key (400/401/403) pauses Gemini for 10 minutes and a quota hit (429) for the
 * delay Google asks, so a broken or rate-limited key never slows every request down.
 */

const KEY_REJECTED_PAUSE_MS = 10 * 60 * 1000;
const BLOCKED = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"]);

let client = null;
let pausedUntil = 0;

const isConfigured = () => Boolean(config.apiKey);
const isAvailable = () => isConfigured() && Date.now() >= pausedUntil;

function getClient() {
  if (!isConfigured()) throw new ApiError(503, "The AI assistant is not configured.", "ASSISTANT_UNAVAILABLE");
  if (!client) client = new GoogleGenerativeAI(config.apiKey);
  return client;
}

/**
 * Gemini accepts an OpenAPI subset: no minimum/maximum/default/additionalProperties, and a
 * function without arguments must omit `parameters`. Limits move into the description; the
 * zod schemas of each tool still enforce them.
 */
function toGeminiSchema(schema) {
  const { minimum, maximum, default: _default, additionalProperties, ...rest } = schema;
  const out = { ...rest };
  if (minimum !== undefined || maximum !== undefined) out.description = `${rest.description ? `${rest.description} ` : ""}(${minimum ?? ""}–${maximum ?? ""})`.trim();
  if (rest.properties) out.properties = Object.fromEntries(Object.entries(rest.properties).map(([key, value]) => [key, toGeminiSchema(value)]));
  if (rest.items) out.items = toGeminiSchema(rest.items);
  return out;
}

/** JSON-schema tool list → Gemini `tools` array. */
const declarations = (tools) => [
  {
    functionDeclarations: tools.map(({ name, description, input_schema: schema }) =>
      Object.keys(schema?.properties ?? {}).length ? { name, description, parameters: toGeminiSchema(schema) } : { name, description }
    ),
  },
];

/** Any failure on the Gemini side (bad key, quota, outage, timeout, network) → an ApiError callers can fall back from. */
function mapSdkError(error) {
  if (error instanceof ApiError) return error;
  const status = error?.status;
  if (status === 429) return new ApiError(503, "The AI assistant is busy, please try again in a moment.", "ASSISTANT_BUSY");
  if (status === 400 || status === 401 || status === 403) return new ApiError(503, "The AI assistant is not available right now.", "ASSISTANT_UNAVAILABLE");
  if (status >= 500 || error?.name === "AbortError" || /fetch failed|timeout|ECONN|ENOTFOUND/i.test(error?.message ?? "")) {
    return new ApiError(503, "The AI assistant could not be reached.", "ASSISTANT_UNAVAILABLE");
  }
  if (error?.name?.startsWith?.("GoogleGenerativeAI")) return new ApiError(502, "The AI assistant returned an error.", "ASSISTANT_ERROR");
  return error;
}

function pauseAfter(error) {
  if ([400, 401, 403].includes(error?.status)) pausedUntil = Date.now() + KEY_REJECTED_PAUSE_MS;
  if (error?.status === 429) {
    // Quota hit (the free tier allows 5 requests/minute): wait what Google asks (retryDelay "27s"), 60 s by default.
    const retry = parseInt((error.errorDetails ?? []).find((d) => d.retryDelay)?.retryDelay, 10);
    pausedUntil = Date.now() + (retry > 0 ? retry * 1000 : 60_000);
  }
}

/** One Gemini call; retries once on a transient 5xx, like ELIZFLOW's generateWithRetry. */
async function generate(model, request) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return (await model.generateContent(request)).response;
    } catch (error) {
      if (attempt >= 2 || !(error?.status >= 500)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Runs a function-calling conversation until Gemini answers in text.
 *   execute(name, args) → object handed back to the model as the function result.
 * Returns { text, blocked, usage, model }. Throws a mapped ApiError when Gemini fails.
 */
async function runToolLoop({ system, tools, messages, execute, maxTurns = config.maxTurns, maxOutputTokens = 1500 }) {
  let usage = { input: 0, output: 0 };
  try {
    const model = getClient().getGenerativeModel(
      {
        model: config.model,
        systemInstruction: system,
        tools: declarations(tools),
        // Factual answers from tool data, no hidden "thinking" pass (latency and quota).
        generationConfig: { maxOutputTokens, temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
      },
      { timeout: 45_000 }
    );
    // Gemini calls the assistant "model"; function results go back as role "function".
    const contents = messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
    // `final` forbids further calls so a tool-happy model still ends with a text answer.
    const request = (final = false) => ({ contents, ...(final && { toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.NONE } } }) });

    let response = await generate(model, request());
    for (let turn = 0; turn <= maxTurns; turn += 1) {
      usage = { input: usage.input + (response.usageMetadata?.promptTokenCount ?? 0), output: usage.output + (response.usageMetadata?.candidatesTokenCount ?? 0) };
      const calls = response.functionCalls?.() ?? [];
      if (calls.length === 0) break;
      contents.push(response.candidates[0].content);
      const parts = await Promise.all(
        calls.map(async (call) => {
          try {
            return { functionResponse: { name: call.name, response: { content: await execute(call.name, call.args ?? {}) } } };
          } catch (error) {
            const reason = error.issues ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") : error.message;
            logger.warn({ tool: call.name, reason }, "[gemini] tool failed");
            return { functionResponse: { name: call.name, response: { error: error.issues ? `Invalid arguments (${reason}). Fix them and call again.` : "The tool failed." } } };
          }
        })
      );
      contents.push({ role: "function", parts }); // all results in ONE turn, in call order
      response = await generate(model, request(turn + 1 >= maxTurns));
    }

    const candidate = response.candidates?.[0];
    const blocked = Boolean(response.promptFeedback?.blockReason) || BLOCKED.has(candidate?.finishReason);
    const text = (candidate?.content?.parts ?? [])
      .filter((part) => typeof part.text === "string" && !part.thought)
      .map((part) => part.text)
      .join("\n")
      .trim();
    return { text, blocked, usage, model: response.modelVersion ?? config.model };
  } catch (error) {
    pauseAfter(error);
    const mapped = mapSdkError(error);
    logger.warn({ code: mapped.code, status: error?.status, reason: String(error?.message ?? "").slice(0, 200) }, "[gemini] request failed");
    throw mapped;
  }
}

module.exports = { isConfigured, isAvailable, declarations, runToolLoop };
