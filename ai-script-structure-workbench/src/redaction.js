const redactedValue = "[已脱敏]";

export function redactApiConfig(apiConfig = {}) {
  if (!apiConfig || typeof apiConfig !== "object") return apiConfig;
  return {
    ...apiConfig,
    providers: (apiConfig.providers || []).map((provider) => ({
      ...provider,
      apiKey: provider.apiKey ? redactedValue : ""
    }))
  };
}

export function sanitizeForExport(value) {
  return deepRedact(value, redactedValue);
}

export function sanitizeStateForSnapshot(state) {
  const clean = sanitizeForExport(state);
  if (clean?.apiConfig) clean.apiConfig = redactApiConfig(clean.apiConfig);
  return clean;
}

function deepRedact(value, replacement) {
  if (Array.isArray(value)) return value.map((item) => deepRedact(item, replacement));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (key.toLowerCase() === "apikey") return [key, item ? replacement : ""];
      return [key, deepRedact(item, replacement)];
    })
  );
}
