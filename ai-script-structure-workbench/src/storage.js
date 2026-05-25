import { createSeedState } from "./seed-data.js";
import { normalizeApiConfig } from "./model-config.js";
import { normalizeSkillList } from "./skill-manager.js";
import { sanitizeStateForSnapshot } from "./redaction.js";

const storageKey = "ai-script-structure-workbench-v1";

export function loadLocalState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return createSeedState();
    return mergeDefaults(JSON.parse(raw), createSeedState());
  } catch {
    return createSeedState();
  }
}

export function saveLocalState(state, options = {}) {
  localStorage.setItem(storageKey, JSON.stringify(state));
  void persistSnapshot(state);
  if (state.apiConfig && options.persistSettings !== false) void persistRuntimeSettings(state.apiConfig);
}

export function resetLocalState(preservedApiConfig = null) {
  const next = createSeedState();
  if (preservedApiConfig) {
    next.apiConfig = normalizeApiConfig(preservedApiConfig);
    next.mode = next.apiConfig.mode;
  }
  saveLocalState(next);
  return next;
}

export async function persistSnapshot(state) {
  try {
    await fetch("/api/snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sanitizeStateForSnapshot(state))
    });
  } catch {
    // Browser localStorage remains the source of truth if the server is unavailable.
  }
}

export async function writeExport(fileName, type, content) {
  try {
    const response = await fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName, type, content })
    });
    if (!response.ok) throw new Error("export failed");
    return response.json();
  } catch {
    return { ok: false, fileName, href: null, path: null };
  }
}

export async function appendModelLog(log) {
  try {
    await fetch("/api/model-call-log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(log)
    });
  } catch {
    // Keep UI usable when running from file:// or a static preview.
  }
}

export async function persistRuntimeSettings(apiConfig) {
  try {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(apiConfig)
    });
  } catch {
    // Settings remain in localStorage when the local service is unavailable.
  }
}

export async function loadRuntimeSettings() {
  try {
    const response = await fetch("/api/settings", { cache: "no-store" });
    if (!response.ok) return null;
    const config = await response.json();
    return config ? normalizeApiConfig(config) : null;
  } catch {
    return null;
  }
}

export function mergeRuntimeApiConfig(localConfig, runtimeConfig) {
  if (!runtimeConfig || !hasUsefulRuntimeSettings(runtimeConfig)) return normalizeApiConfig(localConfig || {});
  const local = normalizeApiConfig(localConfig || {});
  const runtime = normalizeApiConfig(runtimeConfig);
  const localProviders = new Map((local.providers || []).map((provider) => [provider.id, provider]));
  return {
    ...runtime,
    providers: (runtime.providers || []).map((provider) => ({
      ...provider,
      apiKey: provider.apiKey || localProviders.get(provider.id)?.apiKey || ""
    }))
  };
}

export function hasUsefulRuntimeSettings(apiConfig) {
  const config = normalizeApiConfig(apiConfig || {});
  return (
    config.mode === "api" ||
    (config.providers || []).some((provider) => provider.providerType !== "local" && (provider.enabled || provider.apiKey)) ||
    (config.models || []).some((model) => model.providerId !== "provider-demo-local" && model.enabled)
  );
}

function mergeDefaults(value, defaults) {
  return {
    ...defaults,
    ...value,
    scriptInput: { ...defaults.scriptInput, ...(value.scriptInput || {}) },
    currentProject: {
      ...defaults.currentProject,
      ...(value.currentProject || {}),
      creativeConstraints: {
        ...defaults.currentProject.creativeConstraints,
        ...(value.currentProject?.creativeConstraints || {})
      },
      locks: { ...defaults.currentProject.locks, ...(value.currentProject?.locks || {}) }
    },
    assets: { ...defaults.assets, ...(value.assets || {}) },
    skills: normalizeSkillList(value.skills?.length ? value.skills : defaults.skills),
    skillFilters: { ...defaults.skillFilters, ...(value.skillFilters || {}) },
    apiConfig: normalizeApiConfig({ ...defaults.apiConfig, ...(value.apiConfig || {}) })
  };
}
