export async function callOpenAICompatible({ provider, model, messages, options = {} }) {
  if (!provider?.baseUrl) throw new Error("OpenAI-compatible Provider 缺少 Base URL");
  if (!provider?.apiKey) throw new Error("OpenAI-compatible Provider 缺少 API Key");
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
    authorization: `Bearer ${provider.apiKey}`,
    ...(provider.defaultHeaders || {})
  };
  const body = buildOpenAIChatRequestBody({ model, messages, options });

  try {
    const response = await fetch(buildChatCompletionsUrl(provider.baseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const rawText = await response.text();
    if (!response.ok) {
      if (looksLikeGeminiNativeError(rawText)) {
        throw new Error(
          `Provider 请求失败：${response.status} ${rawText.slice(0, 220)}。当前接口不接受 OpenAI Chat Completions 格式。若你使用 OpenAI 代理/DeepSeek，请将 requestFormat 改为 openai_chat，并确认 Base URL 是 OpenAI-compatible 地址；若你使用官方 Gemini API，请改为 gemini_native。`
        );
      }
      throw new Error(`Provider 请求失败：${response.status} ${rawText.slice(0, 300)}`);
    }
    const payload = JSON.parse(rawText);
    return {
      outputText: payload.choices?.[0]?.message?.content || "",
      tokenUsage: payload.usage || null,
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

export function buildOpenAIChatRequestBody({ model, messages, options = {} }) {
  const body = {
    model: model.modelName,
    messages,
    temperature: options.temperature ?? 0.5,
    max_tokens: options.maxOutputTokens || model.maxOutputTokens || 4096
  };
  if (options.jsonModeRequired && model.supportsJsonMode && model.supportsJsonModeExplicit) {
    body.response_format = { type: "json_object" };
  }
  return body;
}

export function buildChatCompletionsUrl(baseUrl = "") {
  const clean = baseUrl.trim().replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(clean)) return clean;
  return `${clean}/chat/completions`;
}

function looksLikeGeminiNativeError(rawText = "") {
  return /Unknown name "messages"|Cannot find field|generateContent|contents/i.test(rawText);
}
