export function resolveRequestFormat({ provider, model } = {}) {
  const requestFormat = provider?.requestFormat || "auto";
  if (requestFormat === "openai_chat") return "openai_chat";
  if (requestFormat === "gemini_native") return "gemini_native";
  if (provider?.providerType === "gemini") return "gemini_native";
  const baseUrl = String(provider?.baseUrl || "").toLowerCase();
  if (baseUrl.includes("generativelanguage.googleapis.com")) return "gemini_native";
  return "openai_chat";
}

export function requestFormatRoutingNote({ provider, model } = {}) {
  const resolved = resolveRequestFormat({ provider, model });
  if ((provider?.requestFormat || "auto") !== "auto") return `用户指定 ${resolved}`;
  if (resolved === "gemini_native") return "auto: Gemini 官方 Provider 或 generativelanguage.googleapis.com";
  return "auto: OpenAI-compatible 默认格式";
}
