export async function callGemini({ provider, model, messages, options = {} }) {
  if (!provider?.baseUrl) throw new Error("Gemini Provider 缺少 Base URL");
  if (!provider?.apiKey) throw new Error("Gemini Provider 缺少 API Key");
  if (!model?.modelName) throw new Error("模型缺少真实 modelName");

  const timeoutMs = options.timeoutMs || provider.timeoutMs || 60000;
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const headers = {
    "content-type": "application/json",
    "x-goog-api-key": provider.apiKey,
    ...(provider.defaultHeaders || {})
  };
  const body = messagesToGeminiRequestBody(messages, {
    temperature: options.temperature ?? 0.5,
    topP: options.topP,
    maxOutputTokens: options.maxOutputTokens || model.maxOutputTokens || 4096,
    jsonModeRequired: Boolean(options.jsonModeRequired && model.supportsJsonMode)
  });

  try {
    const response = await fetch(buildGeminiGenerateContentUrl(provider.baseUrl, model.modelName, provider.apiKey), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`Provider 请求失败：${response.status} ${rawText.slice(0, 300)}`);
    }
    const payload = JSON.parse(rawText);
    return {
      outputText: extractGeminiText(payload),
      tokenUsage: normalizeGeminiUsage(payload.usageMetadata),
      raw: payload
    };
  } catch (error) {
    if (timedOut || error.name === "AbortError") {
      throw new Error(`Provider 请求超时或被中止（${timeoutMs} ms）。请检查网络、Base URL、任务超时或是否重复触发任务。`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function shouldUseGeminiNative({ provider, model } = {}) {
  const requestFormat = provider?.requestFormat || "auto";
  if (requestFormat === "gemini_native") return true;
  if (requestFormat === "openai_chat") return false;
  if (provider?.providerType === "gemini") return true;
  const modelText = `${model?.modelName || ""} ${model?.displayName || ""}`.toLowerCase();
  if (!modelText.includes("gemini")) return false;
  const baseUrl = String(provider?.baseUrl || "").toLowerCase();
  if (baseUrl.includes("/chat/completions")) return false;
  return provider?.providerType === "openai_compatible" || /googleapis|generativelanguage|gemini|yoosheen/.test(baseUrl);
}

export function messagesToGeminiRequestBody(messages = [], options = {}) {
  const systemText = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .filter(Boolean)
    .join("\n\n");
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: String(message.content || "") }]
    }))
    .filter((item) => item.parts[0].text.trim());
  const generationConfig = {
    temperature: options.temperature ?? 0.5,
    maxOutputTokens: options.maxOutputTokens || 4096
  };
  if (Number.isFinite(Number(options.topP))) generationConfig.topP = Number(options.topP);
  if (options.jsonModeRequired) generationConfig.responseMimeType = "application/json";
  return {
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    contents: contents.length ? contents : [{ role: "user", parts: [{ text: "ping" }] }],
    generationConfig
  };
}

export function buildGeminiGenerateContentUrl(baseUrl = "", modelName = "", apiKey = "") {
  let clean = String(baseUrl).trim().replace(/\/+$/, "");
  clean = clean.replace(/\/chat\/completions$/i, "");
  let endpoint = clean;
  if (!/:generateContent(?:\?|$)/i.test(endpoint)) {
    if (/\/models$/i.test(endpoint)) {
      endpoint = `${endpoint}/${encodeURIComponent(modelName)}:generateContent`;
    } else if (/\/v1(?:beta)?$/i.test(endpoint)) {
      endpoint = `${endpoint}/models/${encodeURIComponent(modelName)}:generateContent`;
    } else if (/\/models\/[^/?]+$/i.test(endpoint)) {
      endpoint = `${endpoint}:generateContent`;
    } else {
      endpoint = `${endpoint}/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;
    }
  }
  if (apiKey && !/[?&]key=/.test(endpoint)) {
    endpoint += `${endpoint.includes("?") ? "&" : "?"}key=${encodeURIComponent(apiKey)}`;
  }
  return endpoint;
}

function extractGeminiText(payload = {}) {
  return (
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || ""
  );
}

function normalizeGeminiUsage(usage = null) {
  if (!usage) return null;
  return {
    prompt_tokens: usage.promptTokenCount ?? null,
    completion_tokens: usage.candidatesTokenCount ?? null,
    total_tokens: usage.totalTokenCount ?? null,
    raw: usage
  };
}
