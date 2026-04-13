import { type IAgentRuntime, logger, ModelType } from "@elizaos/core";
import { stripJsonCodeFences } from "./json";

/**
 * Structured model helper for JSON-first prompts.
 *
 * Why this exists:
 * - structured planner/research/synthesis steps need clean JSON in the final
 *   response content, not only reasoning text.
 * - some OpenAI-compatible endpoints expose model-specific request fields
 *   that are not forwarded by the default runtime model path.
 *
 * Behavior:
 * - always try the normal runtime model path first.
 * - if the result is missing or not valid JSON and the configured model
 *   supports a thinking toggle, retry once through the direct endpoint with
 *   thinking disabled.
 */

const getStringSetting = (runtime: IAgentRuntime, key: string): string | null => {
  const value = runtime.getSetting(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const getModelName = (
  runtime: IAgentRuntime,
  modelType: typeof ModelType.TEXT_SMALL | typeof ModelType.TEXT_LARGE
): string | null => {
  if (modelType === ModelType.TEXT_SMALL) {
    return (
      getStringSetting(runtime, "OPENAI_SMALL_MODEL") ??
      getStringSetting(runtime, "SMALL_MODEL")
    );
  }

  return (
    getStringSetting(runtime, "OPENAI_LARGE_MODEL") ??
    getStringSetting(runtime, "LARGE_MODEL")
  );
};

const getNonEmptyString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidateFields = ["text", "content", "response", "output"];
  for (const field of candidateFields) {
    const candidate = (value as Record<string, unknown>)[field];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
};

const getMessageContent = (content: unknown): string | null => {
  if (typeof content === "string" && content.trim().length > 0) {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const text = content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (
        typeof part === "object" &&
        part !== null &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }

      return "";
    })
    .join("")
    .trim();

  return text.length > 0 ? text : null;
};

const isQwenModel = (modelName: string): boolean => /qwen/i.test(modelName);

const isValidJsonText = (text: string): boolean => {
  try {
    JSON.parse(stripJsonCodeFences(text));
    return true;
  } catch {
    return false;
  }
};

type StructuredTextOptions = {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

/**
 * Generate text for structured JSON workflows.
 *
 * The default path uses runtime.useModel(). If that does not produce valid
 * JSON and the configured endpoint supports a thinking toggle, this helper
 * retries once through the direct endpoint with thinking disabled.
 */
export const generateStructuredText = async (
  runtime: IAgentRuntime,
  modelType: typeof ModelType.TEXT_SMALL | typeof ModelType.TEXT_LARGE,
  prompt: string,
  options: StructuredTextOptions = {}
): Promise<string | null> => {
  const baseURL = getStringSetting(runtime, "OPENAI_BASE_URL");
  const apiKey = getStringSetting(runtime, "OPENAI_API_KEY");
  const modelName = getModelName(runtime, modelType);

  let runtimeText: string | null = null;
  let runtimeError: string | null = null;

  try {
    const runtimeResponse = await runtime.useModel(modelType, {
      prompt,
      temperature: options.temperature ?? 0.3,
      maxTokens: options.maxTokens,
    });

    runtimeText = getNonEmptyString(runtimeResponse);
  } catch (error) {
    runtimeError = error instanceof Error ? error.message : String(error);
  }

  if (!modelName || !isQwenModel(modelName) || !baseURL || !apiKey) {
    if (runtimeError) {
      throw new Error(runtimeError);
    }

    return runtimeText;
  }

  if (runtimeText && isValidJsonText(runtimeText)) {
    return runtimeText;
  }

  logger.warn(
    {
      modelName,
      hadContent: Boolean(runtimeText),
      runtimeError,
      responsePreview: runtimeText?.slice(0, 300),
    },
    "Structured model response was missing valid JSON content; retrying with thinking disabled"
  );

  const requestBody: Record<string, unknown> = {
    model: modelName,
    messages: [
      ...(runtime.character.system
        ? [{ role: "system", content: runtime.character.system }]
        : []),
      { role: "user", content: prompt },
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 2048,
    chat_template_kwargs: {
      enable_thinking: false,
    },
  };

  const response = await fetch(`${baseURL.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(options.timeoutMs ?? 60000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Structured model request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: unknown;
        reasoning?: string | null;
      };
    }>;
  };

  const message = payload.choices?.[0]?.message;
  const content = getMessageContent(message?.content);

  if (content) {
    return content;
  }

  if (message?.reasoning) {
    logger.warn(
      { modelName, reasoningPreview: message.reasoning.slice(0, 300) },
      "Structured model response contained reasoning but no final content"
    );
  }

  return runtimeText;
};
