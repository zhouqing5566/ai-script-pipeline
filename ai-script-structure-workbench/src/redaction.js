const redactedValue = "[已脱敏]";

const secretKeyPattern =
  /(apikey|api_key|authorization|access_token|refresh_token|token|secret|password|passwd|credential|cookie|set-cookie|x-goog-api-key|key)$/i;

const stringSecretPatterns = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /sk-[A-Za-z0-9_-]{8,}/gi,
  /AIza[0-9A-Za-z_-]{12,}/gi,
  /([?&](?:api[_-]?key|key|token|access_token)=)[^&\s"']+/gi,
  /(Authorization:\s*)[^\n\r]+/gi
];

function redactSecretString(value, replacement = redactedValue) {
  return String(value).replace(stringSecretPatterns[0], `Bearer ${replacement}`).replace(stringSecretPatterns[1], replacement).replace(stringSecretPatterns[2], replacement).replace(stringSecretPatterns[3], `$1${replacement}`).replace(stringSecretPatterns[4], `$1${replacement}`);
}

export function deepRedactSecrets(value, replacement = redactedValue) {
  if (Array.isArray(value)) return value.map((item) => deepRedactSecrets(item, replacement));
  if (typeof value === "string") return redactSecretString(value, replacement);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (secretKeyPattern.test(String(key))) return [key, item ? replacement : ""];
      return [key, deepRedactSecrets(item, replacement)];
    })
  );
}

export function redactApiConfig(apiConfig = {}) {
  if (!apiConfig || typeof apiConfig !== "object") return apiConfig;
  const clean = deepRedactSecrets(apiConfig);
  return {
    ...clean,
    providers: (clean.providers || []).map((provider) => ({
      ...provider,
      apiKey: provider.apiKey ? redactedValue : ""
    }))
  };
}

export function sanitizeForExport(value) {
  return deepRedactSecrets(value, redactedValue);
}

export function sanitizeStateForSnapshot(state) {
  const clean = sanitizeForExport(state);
  if (clean?.apiConfig) clean.apiConfig = redactApiConfig(clean.apiConfig);
  return clean;
}
