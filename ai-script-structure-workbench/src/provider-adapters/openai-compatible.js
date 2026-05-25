export async function callOpenAICompatible({ provider, model, messages, options = {} }) {
  if (!provider?.baseUrl) throw new Error("OpenAI-compatible Provider 缺少 Base URL");
  if (!provider?.apiKey) throw new Error("OpenAI-compatible Provider 缺少 API Key");
  if (!model?.modelName) throw new Error("模型缺少真实 modelName");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || provider.timeoutMs || 60000);
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${provider.apiKey}`,
    ...(provider.defaultHeaders || {})
  };
  const body = {
    model: model.modelName,
    messages,
    temperature: options.temperature ?? 0.5,
    max_tokens: options.maxOutputTokens || model.maxOutputTokens || 4096
  };
  if (options.jsonModeRequired && model.supportsJsonMode) {
    body.response_format = { type: "json_object" };
  }

  try {
    const response = await fetch(buildChatCompletionsUrl(provider.baseUrl), {
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
      outputText: payload.choices?.[0]?.message?.content || "",
      tokenUsage: payload.usage || null,
      raw: payload
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildChatCompletionsUrl(baseUrl = "") {
  const clean = baseUrl.trim().replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(clean)) return clean;
  return `${clean}/chat/completions`;
}
