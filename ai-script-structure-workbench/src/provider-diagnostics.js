import { resolveRequestFormat } from "./request-format.js";

const protocolMismatchPattern = /Unknown name "messages"|Unknown name "temperature"|Unknown name "max_tokens"|Cannot find field/i;

export function diagnoseProviderProtocol(provider = {}, model = {}, context = {}) {
  const baseUrl = String(provider.baseUrl || "");
  const providerType = provider.providerType || "openai_compatible";
  const requestFormat = provider.requestFormat || "auto";
  const resolvedRequestFormat = resolveRequestFormat({ provider, model });
  const lowerBaseUrl = baseUrl.toLowerCase();
  const lowerModelName = String(model.modelName || model.displayName || "").toLowerCase();
  const issues = [];
  const suggestions = [];
  let severity = "ok";
  let likelyMismatch = "";
  let protocolGuess = "openai_compatible";

  const looksGeminiNative =
    lowerBaseUrl.includes("generativelanguage.googleapis.com") ||
    lowerBaseUrl.includes(":generatecontent") ||
    /\/models\/[^/]+:generatecontent/i.test(baseUrl);
  const looksDeepSeek = providerType === "deepseek" || lowerModelName.includes("deepseek");
  const explicitGeminiOpenAIProxy = Boolean(provider.geminiOpenAICompatibleProxy || provider.allowGeminiOpenAICompatible);

  if (looksGeminiNative) protocolGuess = "gemini_native";
  if (looksDeepSeek) protocolGuess = "openai_chat";

  if (looksGeminiNative && resolvedRequestFormat === "openai_chat") {
    severity = "error";
    likelyMismatch = "openai_chat_to_gemini_native";
    issues.push("Base URL 看起来是 Gemini 官方接口，但当前使用 OpenAI Chat Completions 格式。");
    suggestions.push("将 providerType 改为 gemini，requestFormat 改为 gemini_native。");
  }

  if ((lowerBaseUrl.endsWith(":generatecontent") || /\/models\/[^/]+:generatecontent/i.test(baseUrl)) && requestFormat === "openai_chat") {
    severity = "error";
    likelyMismatch = "openai_chat_to_gemini_native";
    issues.push("Base URL 指向 generateContent 端点，但当前 requestFormat=openai_chat。");
    suggestions.push("官方 Gemini generateContent 端点必须使用 gemini_native；OpenAI-compatible 代理应填写 /v1 或 /chat/completions 兼容地址。");
  }

  if (providerType === "gemini" && resolvedRequestFormat === "openai_chat" && !explicitGeminiOpenAIProxy) {
    severity = "error";
    likelyMismatch = "gemini_provider_openai_chat";
    issues.push("Provider 类型是 gemini，但当前使用 OpenAI Chat 请求格式。");
    suggestions.push("如果这是官方 Gemini API，请改为 gemini_native；只有明确的 Gemini OpenAI-compatible 代理才使用 openai_chat。");
  }

  if (providerType === "openai_compatible" && looksGeminiNative) {
    severity = "error";
    likelyMismatch = "openai_compatible_to_gemini_native";
    issues.push("Provider 类型是 openai_compatible，但 Base URL 看起来是 Gemini native。");
    suggestions.push("不要把 Gemini generateContent 地址填进 OpenAI-compatible 模板。");
  }

  if (looksDeepSeek && resolvedRequestFormat !== "openai_chat") {
    severity = "error";
    likelyMismatch = "deepseek_must_openai_chat";
    issues.push("DeepSeek / deepseek 模型必须使用 openai_chat 请求格式。");
    suggestions.push("将 requestFormat 改为 openai_chat，并确认 Base URL 为 DeepSeek 或 OpenAI-compatible 地址。");
  }

  if (context.errorMessage && protocolMismatchPattern.test(context.errorMessage)) {
    severity = "error";
    likelyMismatch = "protocol_mismatch_openai_body_to_gemini_native";
    issues.push("接口不接受 OpenAI Chat 请求体。");
    suggestions.push("如果你使用 Gemini 官方 API：providerType=gemini，requestFormat=gemini_native。");
    suggestions.push("如果你使用 OpenAI/DeepSeek/代理：Base URL 必须是真正 OpenAI-compatible 的 /v1 或 /chat/completions 地址。");
  }

  if (context.errorMessage && /response_format/i.test(context.errorMessage)) {
    if (severity !== "error") severity = "warning";
    issues.push("接口可能不支持 response_format JSON mode。");
    suggestions.push("关闭该模型的 supportsJsonMode，系统会继续通过 Prompt 要求 JSON。");
  }

  return {
    providerId: provider.id || null,
    modelId: model.id || null,
    baseUrl,
    providerType,
    requestFormat,
    resolvedRequestFormat,
    protocolGuess,
    likelyMismatch,
    severity,
    issues: uniqueList(issues),
    suggestions: uniqueList(suggestions)
  };
}

export function classifyProviderError(error = "") {
  const message = typeof error === "string" ? error : error?.message || String(error || "");
  if (protocolMismatchPattern.test(message) || /当前接口不接受 OpenAI Chat Completions 格式|当前接口不接受 OpenAI Chat Completions 请求体|Gemini 官方接口.*OpenAI Chat|generateContent.*openai_chat|Provider 协议预检失败/i.test(message)) return "provider_protocol_mismatch";
  if (/未找到 Provider 配置|Provider not found|missing provider|缺少 Provider|未找到模型对应 Provider/i.test(message)) return "missing_provider";
  if (/401\b|403\b|unauthorized|forbidden|invalid api key|api key/i.test(message)) return "provider_auth_failed";
  if (/429\b|Resource exhausted|rate limit|quota|too many requests/i.test(message)) return "provider_rate_limit";
  if (/timeout|timed out|AbortError|aborted|请求被中止|signal is aborted/i.test(message)) return "provider_timeout";
  if (/JSON 解析失败|not valid JSON|未找到 JSON|Unexpected token/i.test(message)) return "json_parse_failed";
  if (/schema|结构校验|compact schema|modelStructureIncomplete/i.test(message)) return "task_schema_failed";
  if (/sourceText|原文|source_text/i.test(message)) return "source_text_failed";
  if (/Failed to fetch|fetch failed|500\b|502\b|503\b|504\b/i.test(message)) return "provider_api_failed";
  return "unknown";
}

export function suggestProviderFix(error = "", provider = {}, model = {}) {
  const message = typeof error === "string" ? error : error?.message || String(error || "");
  const suggestions = [];
  if (protocolMismatchPattern.test(message) || /当前接口不接受 OpenAI Chat Completions 格式/i.test(message)) {
    suggestions.push("当前接口不接受 OpenAI Chat Completions 请求体。你可能把 Gemini native 接口配置成了 OpenAI-compatible，或 Base URL 不是 /chat/completions 兼容地址。");
    suggestions.push("如果你使用 Gemini 官方 API：providerType=gemini，requestFormat=gemini_native。");
    suggestions.push("如果你使用 OpenAI/DeepSeek/代理：Base URL 必须是 OpenAI-compatible 的 /v1 或 /chat/completions 地址。");
    suggestions.push("不要把 Gemini generateContent 地址填进 OpenAI-compatible 模板。");
  }
  if (/response_format/i.test(message)) suggestions.push("接口不支持 response_format 时，请关闭该模型的 supportsJsonMode。");
  if (/model not found|not found model|模型不存在|model .* not exist/i.test(message)) suggestions.push("检查 modelName 是否与服务商控制台中的真实模型名一致。");
  if (/401\b|403\b|unauthorized|forbidden|invalid api key|api key/i.test(message)) suggestions.push("检查 API Key、Authorization Header、服务商权限和账号余额。");
  if (/429\b|Resource exhausted|rate limit|quota|too many requests/i.test(message)) suggestions.push("降低并发、增加 retry/backoff、稍后重试，或切换 Provider/API Key。");
  const diagnostics = diagnoseProviderProtocol(provider, model, { errorMessage: message });
  return uniqueList([...suggestions, ...(diagnostics.suggestions || [])]);
}

export function createProviderHealthPatch(status, diagnostics = {}, extra = {}) {
  return {
    status,
    lastCheckedAt: new Date().toISOString(),
    lastErrorType: extra.lastErrorType || "",
    diagnostics,
    checks: extra.checks || null,
    suggestions: extra.suggestions || diagnostics.suggestions || [],
    message: extra.message || ""
  };
}

function uniqueList(items = []) {
  return [...new Set(items.filter(Boolean))];
}
