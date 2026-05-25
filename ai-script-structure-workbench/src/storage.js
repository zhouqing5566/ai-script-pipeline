import { createSeedState } from "./seed-data.js";

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

export function saveLocalState(state) {
  localStorage.setItem(storageKey, JSON.stringify(state));
  void persistSnapshot(state);
}

export function resetLocalState() {
  const next = createSeedState();
  saveLocalState(next);
  return next;
}

export async function persistSnapshot(state) {
  try {
    await fetch("/api/snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state)
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
    assets: { ...defaults.assets, ...(value.assets || {}) }
  };
}
