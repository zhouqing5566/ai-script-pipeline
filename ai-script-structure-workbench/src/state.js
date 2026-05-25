import { loadLocalState, saveLocalState } from "./storage.js";
import { uid } from "./seed-data.js";

export function createStore(onChange) {
  let state = loadLocalState();

  function getState() {
    return state;
  }

  function setState(updater, summary = "更新状态", options = {}) {
    const previous = structuredClone(state);
    state = typeof updater === "function" ? updater(structuredClone(state)) : updater;
    state.saveStatus = "本地已保存";
    state.currentProject.updatedAt = new Date().toISOString();
    if (options.version !== false) {
      state.currentProject.versions = [
        {
          id: uid("version"),
          projectId: state.currentProject.id,
          versionNo: `v${state.currentProject.versions.length + 1}`,
          targetType: options.targetType || "project",
          targetId: options.targetId || state.currentProject.id,
          action: options.action || "edit",
          beforeSnapshot: options.light ? undefined : options.beforeSnapshot ?? summarizeProject(previous.currentProject),
          afterSnapshot: options.light ? undefined : options.afterSnapshot ?? summarizeProject(state.currentProject),
          changeSummary: summary,
          createdAt: new Date().toISOString(),
          createdBy: "本地用户"
        },
        ...(state.currentProject.versions || [])
      ].slice(0, 80);
    }
    saveLocalState(state, { persistSettings: options.persistSettings });
    onChange?.(state, previous);
  }

  return { getState, setState };
}

function summarizeProject(project) {
  return {
    status: project.status,
    locks: project.locks,
    selectedDirection: project.selectedDirection?.title,
    lockedTheme: project.lockedTheme?.themeStatement,
    lockedMainlineReversal: project.lockedMainlineReversal?.title,
    lockedEnding: project.lockedEnding?.title,
    episodeCount: project.episodeOutline?.length || 0,
    auditScore: project.auditReport?.overallScore || null
  };
}
