import { createStore } from "./state.js";
import { callModel, runModelTask, testModelRoute } from "./model-adapter.js";
import { repairEpisode } from "./repair.js";
import { auditDraft } from "./audit.js";
import { loadRuntimeSettings, mergeRuntimeApiConfig, resetLocalState, syncRuntimeSettings, writeExport } from "./storage.js";
import { parseScriptFile } from "./file-parser.js";
import {
  navItems,
  analysisTabs,
  assetCategories,
  lockItems,
  taskLabels,
  statusLabels,
  labelForKey
} from "./schemas.js";
import {
  audienceNeedSkillTypes,
  createNewSkill,
  duplicateSkill,
  detectSkillConflicts,
  functionalSkillTypes,
  genreSkillTypes,
  mergeSkillsDemo,
  rollbackSkill,
  setSkillStatus,
  skillStatuses,
  updateSkill
} from "./skill-manager.js";
import {
  createModelDraft,
  createProviderDraft,
  createRouteDraft,
  applyProviderTemplate,
  coreRouteTaskTypes,
  featureAreas,
  featureAreaForTaskType,
  maskApiKey,
  modelTaskTypes,
  providerTypes,
  qualityLevels,
  requestFormatTypes,
  switchCoreRoutesToModel
} from "./model-config.js";
import {
  exportAnalysisMarkdown,
  exportAuditMarkdown,
  exportCharactersMarkdown,
  exportDraftMarkdown,
  exportOutlineMarkdown,
  exportProjectJson
} from "./export.js";

const root = document.querySelector("#app");
let busyAction = null;
let toast = "";

const store = createStore(() => render());

render();
void hydrateRuntimeSettings();

root.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action], [data-view]");
  if (!target || busyAction) return;
  const payload = {
    action: target.dataset.action || "",
    view: target.dataset.view || "",
    id: target.dataset.id || "",
    no: Number(target.dataset.no) || 0,
    template: target.dataset.template || "",
    text: target.textContent.trim()
  };
  if (payload.view) {
    const next = commitOpenInputsBeforeAction(`切换到${payload.text}`);
    next.view = payload.view;
    store.setState(next, `切换到${payload.text}`, { version: false });
    return;
  }
  commitOpenInputsBeforeAction(payload.action || "执行操作");
  void handleAction(payload);
});

root.addEventListener("change", (event) => {
  const selectedModel = event.target.closest("#current-selected-model");
  if (selectedModel) {
    store.setState((state) => {
      state.apiConfig.selectedModelId = selectedModel.value;
      return state;
    }, "选择当前模型", { targetType: "settings", action: "edit", light: true });
    return;
  }
  const fileInput = event.target.closest("#script-file");
  if (!fileInput?.files?.length) return;
  void handleScriptFileUpload(fileInput);
});

async function handleScriptFileUpload(fileInput) {
  const file = fileInput.files[0];
  busyAction = "解析上传文件";
  render();
  try {
    const text = await parseScriptFile(file);
    const next = readOpenInputs(store.getState());
    next.scriptInput.text = text;
    next.scriptInput.title = next.scriptInput.title || file.name.replace(/\.[^.]+$/, "");
    next.scriptInput.fileName = file.name;
    store.setState(next, "读取上传剧本文本", { targetType: "script", action: "edit" });
    showToast(`已解析：${file.name}`);
  } catch (error) {
    showToast(error.message || "文件解析失败");
  } finally {
    busyAction = null;
    fileInput.value = "";
    render();
  }
}

async function handleAction(payload) {
  const action = payload.action;
  const id = payload.id;
  const no = Number(payload.no);

  try {
    switch (action) {
      case "reset":
        store.setState(resetLocalState(store.getState().apiConfig), "重置 Demo 数据", { version: false });
        showToast("已重置为初始 Demo 数据，API/模型配置已保留");
        break;
      case "analyze-script":
        await executeTask("analyzeScript", (state) => state.scriptInput, (state, output, log) => {
          state.currentAnalysis = output;
          state.currentProject.analysisId = output.id;
          state.modelLogs = [log, ...state.modelLogs].slice(0, 80);
        }, "完成剧本结构分析", { targetType: "analysis", action: "generate" });
        break;
      case "save-case":
        saveCurrentAnalysisAsCase();
        break;
      case "export-analysis":
        await exportContent("剧本结构分析报告", "md", exportAnalysisMarkdown(store.getState().currentAnalysis));
        break;
      case "set-analysis-tab":
        store.setState((state) => {
          state.activeAnalysisTab = id;
          return state;
        }, "切换分析标签", { version: false });
        break;
      case "set-asset-category":
        store.setState((state) => {
          state.activeAssetCategory = id;
          return state;
        }, "切换模式资产分类", { version: false });
        break;
      case "evaluate-idea":
        await executeTask("evaluateIdea", (state) => ({ project: state.currentProject }), (state, output, log) => {
          state.currentProject.ideaEvaluation = output;
          state.currentProject.status = statusLabels.decision;
          state.modelLogs = [log, ...state.modelLogs].slice(0, 80);
        }, "完成创意评估", { targetType: "idea", action: "generate" });
        break;
      case "generate-directions":
        await executeTask("generateDirections", (state) => ({ project: state.currentProject }), (state, output, log) => {
          state.currentProject.directionCandidates = output;
          state.modelLogs = [log, ...state.modelLogs].slice(0, 80);
        }, "生成方向方案", { targetType: "direction", action: "generate" });
        break;
      case "select-direction":
        store.setState((state) => {
          const direction = state.currentProject.directionCandidates.find((item) => item.id === id);
          state.currentProject.selectedDirection = direction || null;
          return state;
        }, "选择创意方向", { targetType: "direction", targetId: id, action: "edit" });
        break;
      case "lock-direction":
        lockSelected("direction", "锁定创意方向");
        break;
      case "generate-themes":
        await executeTask("generateThemeCandidates", (state) => ({ project: state.currentProject }), (state, output, log) => {
          state.currentProject.themeCandidates = output;
          state.modelLogs = [log, ...state.modelLogs].slice(0, 80);
        }, "生成主题与情绪方案", { targetType: "theme", action: "generate" });
        break;
      case "lock-theme":
        lockCandidate("theme", id);
        break;
      case "generate-reversals":
        await executeTask("generateMainlineReversals", (state) => ({ project: state.currentProject }), (state, output, log) => {
          state.currentProject.mainlineReversalCandidates = output;
          state.modelLogs = [log, ...state.modelLogs].slice(0, 80);
        }, "生成主线大反差方案", { targetType: "reversal", action: "generate" });
        break;
      case "lock-reversal":
        lockCandidate("reversal", id);
        break;
      case "generate-ending-nodes":
        await executeTask("generateEndingCandidates", (state) => ({ project: state.currentProject }), (state, endings, logA) => {
          state.currentProject.endingCandidates = endings;
          state.modelLogs = [logA, ...state.modelLogs].slice(0, 80);
        }, "生成结局方案", { targetType: "ending", action: "generate" });
        await executeTask("generateMajorNodes", (state) => ({ project: state.currentProject }), (state, nodes, logB) => {
          state.currentProject.majorNodeCandidates = nodes;
          state.modelLogs = [logB, ...state.modelLogs].slice(0, 80);
        }, "生成大节点方案", { targetType: "majorNodes", action: "generate" });
        break;
      case "lock-ending":
        lockCandidate("ending", id);
        break;
      case "lock-nodes":
        lockCandidate("nodes", id);
        break;
      case "generate-outline":
        await executeTask("generateMacroOutline", (state) => ({ project: state.currentProject }), (state, macro, logA) => {
          state.currentProject.macroOutline = macro;
          state.currentProject.stageOutline = macro.stageOutline;
          state.modelLogs = [logA, ...state.modelLogs].slice(0, 80);
        }, "生成宏观结构与阶段大纲", { targetType: "macroOutline", action: "generate" });
        await executeTask("generateEpisodeOutline", (state) => ({ project: state.currentProject }), (state, episodes, logB) => {
          state.currentProject.episodeOutline = episodes;
          state.currentProject.status = statusLabels.outline;
          state.selectedEpisodeNo = 1;
          state.modelLogs = [logB, ...state.modelLogs].slice(0, 80);
        }, "生成分集细纲", { targetType: "episodeOutline", action: "generate" });
        break;
      case "select-episode":
        store.setState((state) => {
          state.selectedEpisodeNo = no;
          return state;
        }, `选择第 ${no} 集`, { version: false });
        break;
      case "save-episode-edits":
        saveEpisodeEdits(no);
        break;
      case "lock-outline":
        store.setState((state) => {
          state.currentProject.locks.stageOutline = true;
          state.currentProject.locks.episodeOutline = true;
          return state;
        }, "锁定阶段大纲和分集细纲", { targetType: "episodeOutline", action: "lock" });
        break;
      case "audit-outline":
        await executeTask("auditOutline", (state) => ({ project: state.currentProject }), (state, audit, log) => {
          state.currentProject.auditReport = audit;
          state.currentProject.status = statusLabels.audit;
          state.modelLogs = [log, ...state.modelLogs].slice(0, 80);
        }, "完成细纲审计", { targetType: "audit", action: "generate" });
        break;
      case "repair-episode":
        repairSelectedEpisode(no);
        break;
      case "generate-draft":
        await executeTask("generateDraft", (state) => ({ project: state.currentProject, episodeNo: no || state.selectedEpisodeNo }), (state, draft, log) => {
          if (!draft) return;
          const existing = state.currentProject.draftEpisodes.filter((item) => item.episodeNo !== draft.episodeNo);
          state.currentProject.draftEpisodes = [draft, ...existing].sort((a, b) => a.episodeNo - b.episodeNo);
          state.currentProject.status = statusLabels.draft;
          state.modelLogs = [log, ...state.modelLogs].slice(0, 80);
        }, "生成单集成稿", { targetType: "draft", action: "generate" });
        break;
      case "audit-draft":
        auditSelectedDraft(no || store.getState().selectedEpisodeNo);
        break;
      case "export-outline":
        await exportContent("分集细纲", "md", exportOutlineMarkdown(store.getState().currentProject));
        break;
      case "export-characters":
        await exportContent("人物小传", "md", exportCharactersMarkdown(store.getState().currentProject));
        break;
      case "export-audit":
        await exportContent("审计报告", "md", exportAuditMarkdown(store.getState().currentProject.auditReport));
        break;
      case "export-draft":
        await exportContent("成稿", "md", exportDraftMarkdown(store.getState().currentProject));
        break;
      case "export-json":
        await exportContent("完整项目", "json", exportProjectJson(store.getState()));
        break;
      case "freeze-project":
        freezeProject();
        break;
      case "skill-suggestion":
        await executeTask("generateSkillSuggestion", (state) => {
          const skill = state.skills.find((item) => item.id === id) || state.skills[0];
          return { skill };
        }, (state, suggestion, log) => {
          state.skillSuggestion = suggestion;
          state.modelLogs = [log, ...state.modelLogs].slice(0, 80);
        }, "生成 Skill 优化建议", { targetType: "skill", targetId: id, action: "generate" });
        break;
      case "test-skill":
        await executeTask("testSkillVersion", (state) => {
          const skill = state.skills.find((item) => item.id === id) || state.skills[0];
          return { skill };
        }, (state, report, log) => {
          state.skillComparisonReport = report;
          state.modelLogs = [log, ...state.modelLogs].slice(0, 80);
        }, "运行 Skill 回归测试", { targetType: "skill", targetId: id, action: "generate" });
        break;
      case "enable-skill":
        enableSkillUpdate(id);
        break;
      case "select-skill":
        store.setState((state) => {
          state.selectedSkillId = id;
          return state;
        }, "选择 Skill", { version: false });
        break;
      case "apply-skill-filters":
        applySkillFilters();
        break;
      case "add-skill":
        addSkill();
        break;
      case "save-skill":
        saveSkillEdits(id);
        break;
      case "copy-skill":
        copySkill(id);
        break;
      case "toggle-skill":
        toggleSkill(id);
        break;
      case "rollback-skill":
        rollbackSelectedSkill(id);
        break;
      case "merge-skill-demo":
        mergeSelectedSkill(id);
        break;
      case "set-settings-tab":
        store.setState((state) => {
          state.apiConfig.activeSettingsTab = id;
          return state;
        }, "切换 API 配置标签", { version: false });
        break;
      case "set-api-mode":
        await saveApiMode();
        break;
      case "add-provider":
        addProvider();
        break;
      case "add-provider-template":
        addProviderTemplate(payload.template || "openai_proxy");
        break;
      case "save-provider":
        await saveProvider(id);
        break;
      case "select-provider":
        store.setState((state) => {
          state.apiConfig.selectedProviderId = id;
          return state;
        }, "选择 API Provider", { version: false });
        break;
      case "test-provider":
        await testProvider(id);
        break;
      case "add-model":
        addModel();
        break;
      case "save-model":
        await saveModel(id);
        break;
      case "select-model":
        store.setState((state) => {
          state.apiConfig.selectedModelId = id;
          return state;
        }, "选择模型", { version: false });
        break;
      case "add-route":
        addRoute();
        break;
      case "save-route":
        await saveRoute(id);
        break;
      case "select-route":
        store.setState((state) => {
          state.apiConfig.selectedRouteId = id;
          return state;
        }, "选择路由", { version: false });
        break;
      case "test-task-route":
        await testCurrentTaskRoute();
        break;
      case "switch-core-routes":
        await switchCoreTasksToSelectedModel();
        break;
      case "add-feedback":
        addFeedback();
        break;
      case "copy-export-link":
        if (store.getState().lastExport?.href) await navigator.clipboard.writeText(location.origin + store.getState().lastExport.href);
        showToast("导出链接已复制");
        break;
      default:
        showToast("这个操作还在排队开发");
    }
  } catch (error) {
    busyAction = null;
    if (error.log) {
      store.setState((state) => {
        state.modelLogs = [error.log, ...state.modelLogs].slice(0, 80);
        return state;
      }, "记录失败的模型调用", { targetType: "modelLog", action: "generate", light: true });
    }
    showToast(error.message || "操作失败");
  }
}

async function hydrateRuntimeSettings() {
  const runtimeConfig = await loadRuntimeSettings();
  if (!runtimeConfig) return;
  const current = store.getState();
  const merged = mergeRuntimeApiConfig(current.apiConfig, runtimeConfig);
  if (JSON.stringify(merged) === JSON.stringify(current.apiConfig)) return;
  store.setState((state) => {
    state.apiConfig = merged;
    state.mode = merged.mode;
    return state;
  }, "恢复本地 API 与模型配置", { version: false });
  showToast("已从本地服务恢复 API 与模型配置");
}

async function syncApiSettings(options = {}) {
  const successMessage = options.successMessage || "配置已同步到本地服务。";
  const failureMessage = options.failureMessage || "本地服务设置同步失败，测试连接可能读取旧配置。";
  const result = await syncRuntimeSettings(store.getState().apiConfig);
  store.setState((state) => {
    state.apiConfig.lastSettingsSync = {
      success: Boolean(result.ok),
      message: result.ok ? successMessage : failureMessage,
      error: result.error || null,
      createdAt: new Date().toISOString()
    };
    return state;
  }, "同步 API 设置到本地服务", { version: false, persistSettings: false });
  if (options.show !== false) {
    showToast(result.ok ? successMessage : `${failureMessage}${result.error ? `：${result.error}` : ""}`);
  }
  return result;
}

async function executeTask(taskType, inputFactory, applyOutput, summary, options = {}) {
  const current = commitOpenInputsBeforeAction(taskLabels[taskType] || taskType);
  busyAction = taskLabels[taskType] || taskType;
  render();
  const { output, log, result } = await runModelTask(taskType, inputFactory(current), current);
  applyOutput(current, output, log);
  busyAction = null;
  store.setState(current, summary, options);
  showToast(result?.warnings?.length ? `${summary}。${result.warnings[0]}` : summary);
}

function commitOpenInputsBeforeAction(actionName = "执行操作") {
  const current = store.getState();
  const next = readOpenInputs(current);
  if (!openInputsChanged(current, next)) return next;
  store.setState(next, `保存当前输入：${actionName}`, { version: false });
  return next;
}

function openInputsChanged(current, next) {
  const pick = (state) => ({
    scriptInput: state.scriptInput,
    projectInput: {
      title: state.currentProject.title,
      creativeInput: state.currentProject.creativeInput,
      episodeCount: state.currentProject.creativeConstraints?.episodeCount,
      targetAudience: state.currentProject.creativeConstraints?.targetAudience,
      tone: state.currentProject.creativeConstraints?.tone
    }
  });
  return JSON.stringify(pick(current)) !== JSON.stringify(pick(next));
}

function inputMetaForTask(state, taskType) {
  if (taskType === "analyzeScript") return state.scriptInput;
  if (taskType === "generateDraft") return { project: state.currentProject, episodeNo: state.selectedEpisodeNo || 1 };
  if (taskType === "auditDraft") return { draft: state.currentProject.draftEpisodes?.[0] || null, project: state.currentProject };
  if (taskType === "jsonRepair") return { project: state.currentProject, brokenText: "{\"ok\":true", errors: ["测试 JSON 修复"] };
  return { project: state.currentProject };
}

function readOpenInputs(baseState) {
  const state = structuredClone(baseState);
  const scriptTitle = document.querySelector("#script-title");
  const scriptText = document.querySelector("#script-text");
  const scriptGenre = document.querySelector("#script-genre");
  const scriptEpisodeCount = document.querySelector("#script-episode-count");
  const scriptGranularity = document.querySelector("#script-granularity");
  if (scriptTitle) state.scriptInput.title = scriptTitle.value;
  if (scriptText) state.scriptInput.text = scriptText.value;
  if (scriptGenre) state.scriptInput.genre = scriptGenre.value;
  if (scriptEpisodeCount) state.scriptInput.episodeCount = Number(scriptEpisodeCount.value) || 24;
  if (scriptGranularity) state.scriptInput.granularity = scriptGranularity.value;

  const ideaText = document.querySelector("#idea-text");
  const projectTitle = document.querySelector("#project-title");
  const episodeCount = document.querySelector("#project-episode-count");
  const targetAudience = document.querySelector("#project-target-audience");
  const tone = document.querySelector("#project-tone");
  if (ideaText) state.currentProject.creativeInput = ideaText.value;
  if (projectTitle) {
    state.currentProject.title = projectTitle.value;
    state.scriptInput.title = state.scriptInput.title || projectTitle.value;
  }
  if (episodeCount) state.currentProject.creativeConstraints.episodeCount = Number(episodeCount.value) || 24;
  if (targetAudience) state.currentProject.creativeConstraints.targetAudience = targetAudience.value;
  if (tone) state.currentProject.creativeConstraints.tone = tone.value;
  return state;
}

function saveCurrentAnalysisAsCase() {
  const analysis = store.getState().currentAnalysis;
  if (!analysis) {
    showToast("请先完成剧本分析");
    return;
  }
  if (!canUseAnalysisForLearning(analysis)) {
    showToast("该分析大量字段由本地规则补齐，不能用于案例库、模式资产或 Skill 沉淀。请重新分析或执行结构修复。");
    return;
  }
  store.setState((state) => {
    const item = {
      id: analysis.id,
      title: analysis.title,
      genre: analysis.classificationTags.genre,
      audienceNeeds: analysis.classificationTags.audienceNeeds,
      hookTypes: analysis.classificationTags.hookTypes,
      goldfingerTypes: analysis.classificationTags.goldfingerTypes,
      mainlineReversalTypes: analysis.classificationTags.mainlineReversalTypes,
      episodeCount: analysis.basicInfo.episodeCount,
      qualityScore: Math.round(
        (analysis.hookAnalysis.hookStrengthScore + analysis.themeAnalysis.themeStrengthScore + analysis.mainlineStructure.mainlineStrengthScore) / 3
      ),
      createdAt: new Date().toISOString(),
      tags: ["结构分析", "可复用模式", analysis.basicInfo.format],
      status: analysis.sourceMeta?.needsReview ? "待复核" : "待审核",
      summary: analysis.basicInfo.coreAppeal,
      analysis
    };
    state.cases = [item, ...state.cases.filter((caseItem) => caseItem.id !== item.id)];
    return state;
  }, "保存分析结果到案例库", { targetType: "case", targetId: analysis.id, action: "generate" });
  showToast("已加入案例库");
}

function canUseAnalysisForLearning(analysis) {
  return Boolean(analysis) && !analysis.sourceMeta?.blockedSave && analysis.usableForLearning !== false;
}

function lockSelected(key, summary) {
  store.setState((state) => {
    if (key === "direction" && !state.currentProject.selectedDirection && state.currentProject.directionCandidates[0]) {
      state.currentProject.selectedDirection = state.currentProject.directionCandidates[0];
    }
    state.currentProject.locks[key] = true;
    return state;
  }, summary, { targetType: key, action: "lock" });
}

function lockCandidate(type, id) {
  const map = {
    theme: ["themeCandidates", "lockedTheme", "theme", "锁定主题与情绪"],
    reversal: ["mainlineReversalCandidates", "lockedMainlineReversal", "reversal", "锁定主线大反差"],
    ending: ["endingCandidates", "lockedEnding", "ending", "锁定结局"],
    nodes: ["majorNodeCandidates", "lockedMajorNodes", "majorNodes", "锁定大节点"]
  };
  const [listKey, targetKey, lockKey, summary] = map[type];
  store.setState((state) => {
    state.currentProject[targetKey] = state.currentProject[listKey].find((item) => item.id === id) || state.currentProject[listKey][0] || null;
    state.currentProject.locks[lockKey] = true;
    return state;
  }, summary, { targetType: lockKey, targetId: id, action: "lock" });
}

function saveEpisodeEdits(episodeNo) {
  const state = store.getState();
  const no = episodeNo || state.selectedEpisodeNo;
  const fields = ["openingHook", "episodeGoal", "conflict", "keyEvent", "coolMoment", "characterFunction", "themeFunction", "relationshipChange", "cliffhanger"];
  store.setState((next) => {
    next.currentProject.episodeOutline = next.currentProject.episodeOutline.map((episode) => {
      if (episode.episodeNo !== no) return episode;
      const edited = { ...episode };
      for (const field of fields) {
        const input = document.querySelector(`[data-episode-field="${field}"]`);
        if (input) edited[field] = input.value;
      }
      return edited;
    });
    return next;
  }, `保存第 ${no} 集人工修正`, { targetType: "episode", targetId: String(no), action: "edit" });
  showToast("分集修正已保存");
}

function repairSelectedEpisode(episodeNo) {
  const no = episodeNo || store.getState().selectedEpisodeNo;
  const { project, repair } = repairEpisode(store.getState().currentProject, no);
  if (!repair) {
    showToast("没有找到目标集数");
    return;
  }
  store.setState((state) => {
    state.currentProject = {
      ...project,
      repairs: [repair, ...(project.repairs || [])]
    };
    state.selectedEpisodeNo = no;
    return state;
  }, repair.changeSummary, { targetType: "episode", targetId: String(no), action: "repair" });
  showToast(`第 ${no} 集已局部修复`);
}

function auditSelectedDraft(episodeNo) {
  store.setState((state) => {
    state.currentProject.draftEpisodes = state.currentProject.draftEpisodes.map((draft) =>
      draft.episodeNo === episodeNo ? { ...draft, draftAudit: auditDraft(draft) } : draft
    );
    return state;
  }, `完成第 ${episodeNo} 集成稿审计`, { targetType: "draft", targetId: String(episodeNo), action: "generate" });
}

async function exportContent(fileName, type, content) {
  const result = await writeExport(fileName, type, content);
  store.setState((state) => {
    state.lastExport = {
      ...result,
      fileName,
      type,
      createdAt: new Date().toISOString()
    };
    return state;
  }, `导出${fileName}`, { targetType: "export", action: "generate", light: true });
  showToast(result.ok ? `已导出：${result.fileName}` : "导出已生成，但本地服务未落盘");
}

function freezeProject() {
  store.setState((state) => {
    state.currentProject.freezeSnapshots = [
      {
        id: `freeze-${Date.now().toString(36)}`,
        projectId: state.currentProject.id,
        title: `${state.currentProject.title} 冻结快照`,
        frozenAt: new Date().toISOString(),
        frozenBy: "本地用户",
        snapshotData: {
          locks: state.currentProject.locks,
          macroOutline: state.currentProject.macroOutline,
          stageOutline: state.currentProject.stageOutline,
          episodeOutline: state.currentProject.episodeOutline,
          auditReport: state.currentProject.auditReport
        },
        notes: "冻结当前结构、细纲与审计状态。"
      },
      ...(state.currentProject.freezeSnapshots || [])
    ];
    state.currentProject.status = statusLabels.frozen;
    return state;
  }, "冻结项目快照", { targetType: "project", action: "freeze" });
}

function enableSkillUpdate(skillId) {
  const report = store.getState().skillComparisonReport;
  if (!report) {
    showToast("请先运行 Skill 回归测试");
    return;
  }
  store.setState((state) => {
    state.skills = state.skills.map((skill) =>
      skill.id === skillId
        ? {
            ...skill,
            version: report.newSkillVersion,
            status: "已启用",
            updateReason: "基于回归测试启用新版本",
            updatedAt: new Date().toISOString(),
            testResults: [report, ...(skill.testResults || [])],
            changelog: [
              {
                at: new Date().toISOString(),
                summary: "启用回归测试通过的新版本",
                passed: true
              },
              ...(skill.changelog || [])
            ]
          }
        : skill
    );
    return state;
  }, "启用 Skill 新版本", { targetType: "skill", targetId: skillId, action: "edit" });
}

function applySkillFilters() {
  store.setState((state) => {
    state.skillFilters = {
      function: document.querySelector("#skill-filter-function")?.value || "全部",
      genre: document.querySelector("#skill-filter-genre")?.value || "全部",
      audience: document.querySelector("#skill-filter-audience")?.value || "全部",
      status: document.querySelector("#skill-filter-status")?.value || "全部"
    };
    return state;
  }, "应用 Skill 筛选", { version: false });
}

function addSkill() {
  const skill = createNewSkill();
  store.setState((state) => {
    state.skills = [skill, ...state.skills];
    state.selectedSkillId = skill.id;
    return state;
  }, "新增 Skill", { targetType: "skill", targetId: skill.id, action: "generate" });
}

function saveSkillEdits(skillId) {
  const modelPreference = {
    preferredModelIds: parseCsv(document.querySelector('[data-skill-model="preferredModelIds"]')?.value),
    forbiddenModelIds: parseCsv(document.querySelector('[data-skill-model="forbiddenModelIds"]')?.value),
    requireCapabilities: parseCsv(document.querySelector('[data-skill-model="requireCapabilities"]')?.value),
    allowFallback: document.querySelector('[data-skill-model="allowFallback"]')?.checked ?? true,
    fallbackStrategy: document.querySelector('[data-skill-model="fallbackStrategy"]')?.value || "",
    notes: document.querySelector('[data-skill-model="notes"]')?.value || ""
  };
  const patch = {
    name: readSkillField("name"),
    description: readSkillField("description"),
    category: readSkillField("category"),
    skillType: readSkillField("skillType"),
    source: readSkillField("source"),
    status: readSkillField("status"),
    version: readSkillField("version"),
    priority: Number(readSkillField("priority")) || 50,
    genreScope: parseCsv(readSkillField("genreScope")),
    audienceNeedScope: parseCsv(readSkillField("audienceNeedScope")),
    platformScope: parseCsv(readSkillField("platformScope")),
    taskScope: parseCsv(readSkillField("taskScope")),
    rules: parseLines(readSkillField("rules")),
    positiveExamples: parseLines(readSkillField("positiveExamples")),
    negativeExamples: parseLines(readSkillField("negativeExamples")),
    promptAdditions: parseLines(readSkillField("promptAdditions")),
    outputSchemaRef: readSkillField("outputSchemaRef"),
    evaluationCriteria: parseLines(readSkillField("evaluationCriteria")),
    riskWarnings: parseLines(readSkillField("riskWarnings")),
    modelPreference,
    changeSummary: "保存 Skill 编辑"
  };
  store.setState((state) => {
    state.skills = updateSkill(state.skills, skillId, patch);
    return state;
  }, "保存 Skill 编辑", { targetType: "skill", targetId: skillId, action: "edit" });
}

function copySkill(skillId) {
  store.setState((state) => {
    state.skills = duplicateSkill(state.skills, skillId);
    state.selectedSkillId = state.skills[0]?.id || skillId;
    return state;
  }, "复制 Skill", { targetType: "skill", targetId: skillId, action: "generate" });
}

function toggleSkill(skillId) {
  const current = store.getState().skills.find((skill) => skill.id === skillId);
  const nextStatus = current?.status === "已启用" ? "已停用" : "已启用";
  store.setState((state) => {
    state.skills = setSkillStatus(state.skills, skillId, nextStatus);
    return state;
  }, `${nextStatus} Skill`, { targetType: "skill", targetId: skillId, action: "edit" });
}

function rollbackSelectedSkill(skillId) {
  store.setState((state) => {
    state.skills = rollbackSkill(state.skills, skillId);
    return state;
  }, "回滚 Skill", { targetType: "skill", targetId: skillId, action: "rollback" });
}

function mergeSelectedSkill(skillId) {
  const candidate = store.getState().skills.find((skill) => skill.id !== skillId && skill.status === "已启用");
  store.setState((state) => {
    state.skills = mergeSkillsDemo(state.skills, [skillId, candidate?.id].filter(Boolean));
    state.selectedSkillId = state.skills[0]?.id || skillId;
    return state;
  }, "Demo 合并 Skill", { targetType: "skill", targetId: skillId, action: "generate" });
}

async function saveApiMode() {
  const nextMode = document.querySelector("#api-mode")?.value || "demo";
  const allowDemoInApiMode = document.querySelector("#allow-demo-in-api-mode")?.checked || false;
  const selectedModelId = document.querySelector("#current-selected-model")?.value || store.getState().apiConfig.selectedModelId;
  if (
    nextMode === "api" &&
    allowDemoInApiMode &&
    !store.getState().apiConfig.allowDemoInApiMode &&
    !window.confirm("开启后，真实 API Mode 下部分任务可能继续使用 DemoRuleEngine。请仅在调试或演示时开启。")
  ) {
    return;
  }
  store.setState((state) => {
    state.apiConfig.mode = nextMode;
    state.apiConfig.globalDefaultModelId = document.querySelector("#global-default-model")?.value || "model-demo-rule-engine";
    state.apiConfig.selectedModelId = selectedModelId;
    state.apiConfig.allowDemoInApiMode = allowDemoInApiMode;
    state.mode = state.apiConfig.mode;
    state.apiConfig.updatedAt = new Date().toISOString();
    return state;
  }, "保存 API 运行模式", { targetType: "settings", action: "edit", light: true });
  await syncApiSettings();
}

function addProvider() {
  const provider = createProviderDraft();
  store.setState((state) => {
    state.apiConfig.providers = [provider, ...state.apiConfig.providers];
    state.apiConfig.selectedProviderId = provider.id;
    return state;
  }, "新增 API Provider", { targetType: "settings", action: "generate", light: true });
}

function addProviderTemplate(templateType) {
  store.setState((state) => {
    state.apiConfig = applyProviderTemplate(state.apiConfig, templateType);
    return state;
  }, templateType === "deepseek" ? "新增 DeepSeek 官方模板" : "新增 OpenAI-compatible 代理模板", { targetType: "settings", action: "generate", light: true });
  showToast(templateType === "deepseek" ? "已添加 DeepSeek 官方模板" : "已添加 OpenAI-compatible 代理模板");
}

async function saveProvider(providerId) {
  store.setState((state) => {
    state.apiConfig.providers = state.apiConfig.providers.map((provider) =>
      provider.id === providerId
        ? {
            ...provider,
            name: readProviderField("name"),
            providerType: readProviderField("providerType"),
            requestFormat: readProviderField("requestFormat"),
            baseUrl: readProviderField("baseUrl"),
            apiKey: readProviderField("apiKey") || provider.apiKey,
            enabled: document.querySelector('[data-provider-field="enabled"]')?.checked || false,
            priority: Number(readProviderField("priority")) || 50,
            timeoutMs: Number(readProviderField("timeoutMs")) || 60000,
            rateLimit: readProviderField("rateLimit"),
            notes: readProviderField("notes"),
            updatedAt: new Date().toISOString()
          }
        : provider
    );
    state.apiConfig.updatedAt = new Date().toISOString();
    return state;
  }, "保存 API Provider", { targetType: "settings", action: "edit", light: true });
  await syncApiSettings();
}

async function testProvider(providerId) {
  const current = store.getState();
  const provider = current.apiConfig.providers.find((item) => item.id === providerId);
  const model = current.apiConfig.models.find((item) => item.providerId === providerId && item.enabled);
  let result = { ok: false, error: "Provider 未启用，或缺少 Base URL / API Key。" };
  if (current.apiConfig.selectedProviderId === providerId && hasUnsavedProviderFormChanges(provider)) {
    result = { ok: false, error: "请先保存 Provider，再测试连接。" };
  } else if (!model && provider?.providerType !== "local") {
    result = { ok: false, error: "该 Provider 下没有启用模型，请先新增或启用一个模型。" };
  } else if (provider?.enabled && (provider.providerType === "local" || (provider.baseUrl && provider.apiKey))) {
    try {
      const synced = await syncApiSettings({ successMessage: "测试前已同步配置到本地服务。", show: false });
      if (!synced.ok) throw new Error("本地服务设置同步失败，测试连接可能读取旧配置。");
      const response = await fetch("/api/test-provider", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerId, modelId: model?.id || null })
      });
      result = await response.json();
    } catch (error) {
      result = { ok: false, error: error.message };
    }
  }
  store.setState((state) => {
    state.apiConfig.lastTestResult = {
      providerId,
      success: Boolean(result.ok),
      message: result.message || result.error || "测试完成。",
      mode: result.mode || (provider?.providerType === "local" ? "demo" : "api"),
      endpointType: result.endpointType || (provider?.providerType === "local" ? "local_demo" : "server_proxy"),
      requestFormat: result.requestFormat || provider?.requestFormat || "auto",
      serverStatus: result.serverStatus || result.status || null,
      providerStatus: result.providerStatus || null,
      providerRawPreview: result.providerRawPreview || "",
      settingsUpdatedAt: result.settingsUpdatedAt || null,
      providerUpdatedAt: result.providerUpdatedAt || null,
      modelUpdatedAt: result.modelUpdatedAt || null,
      createdAt: new Date().toISOString()
    };
    return state;
  }, "测试 Provider 配置", { targetType: "settings", action: "generate", light: true });
  showToast(result.ok ? (result.mode === "demo" ? "Demo Provider 测试完成，不代表真实 API 可用" : "Provider 测试通过") : `Provider 测试失败：${result.error || result.message || "未知错误"}`);
}

function hasUnsavedProviderFormChanges(provider) {
  if (!provider) return false;
  const apiKeyInput = document.querySelector('[data-provider-field="apiKey"]')?.value?.trim() || "";
  if (apiKeyInput && apiKeyInput !== provider.apiKey) return true;
  const enabled = document.querySelector('[data-provider-field="enabled"]')?.checked || false;
  return (
    readProviderField("name") !== provider.name ||
    readProviderField("providerType") !== provider.providerType ||
    readProviderField("requestFormat") !== (provider.requestFormat || "auto") ||
    readProviderField("baseUrl") !== provider.baseUrl ||
    enabled !== Boolean(provider.enabled) ||
    Number(readProviderField("priority") || 50) !== Number(provider.priority || 50) ||
    Number(readProviderField("timeoutMs") || 60000) !== Number(provider.timeoutMs || 60000)
  );
}

function addModel() {
  const model = createModelDraft(store.getState().apiConfig.selectedProviderId);
  store.setState((state) => {
    state.apiConfig.models = [model, ...state.apiConfig.models];
    state.apiConfig.selectedModelId = model.id;
    return state;
  }, "新增模型", { targetType: "settings", action: "generate", light: true });
}

async function saveModel(modelId) {
  store.setState((state) => {
    state.apiConfig.models = state.apiConfig.models.map((model) =>
      model.id === modelId
        ? {
            ...model,
            displayName: readModelField("displayName"),
            modelName: readModelField("modelName"),
            providerId: readModelField("providerId"),
            enabled: document.querySelector('[data-model-field="enabled"]')?.checked || false,
            modelType: parseCsv(readModelField("modelType")),
            contextWindow: Number(readModelField("contextWindow")) || 32000,
            maxOutputTokens: Number(readModelField("maxOutputTokens")) || 4096,
            supportsJsonMode: document.querySelector('[data-model-field="supportsJsonMode"]')?.checked || false,
            supportsJsonModeExplicit: document.querySelector('[data-model-field="supportsJsonMode"]')?.checked || false,
            supportsVision: document.querySelector('[data-model-field="supportsVision"]')?.checked || false,
            supportsTools: document.querySelector('[data-model-field="supportsTools"]')?.checked || false,
            supportsStreaming: document.querySelector('[data-model-field="supportsStreaming"]')?.checked || false,
            costLevel: readModelField("costLevel"),
            qualityLevel: readModelField("qualityLevel"),
            recommendedTasks: parseCsv(readModelField("recommendedTasks")),
            notes: readModelField("notes"),
            updatedAt: new Date().toISOString()
          }
        : model
    );
    state.apiConfig.updatedAt = new Date().toISOString();
    return state;
  }, "保存模型配置", { targetType: "settings", action: "edit", light: true });
  await syncApiSettings();
}

async function testCurrentTaskRoute() {
  const taskType = document.querySelector("#route-test-task")?.value || store.getState().apiConfig.routeTestTaskType || "analyzeScript";
  busyAction = "测试当前任务路由";
  render();
  await syncApiSettings({ successMessage: "测试前已同步配置到本地服务。", show: false });
  const current = readOpenInputs(store.getState());
  const result = await testModelRoute({
    taskType,
    featureArea: featureAreaForTaskType(taskType),
    projectId: current.currentProject.id,
    inputMeta: { project: current.currentProject },
    state: current
  });
  store.setState((state) => {
    state.apiConfig.routeTestTaskType = taskType;
    state.apiConfig.lastRouteTestResult = {
      taskType,
      routeId: result.log?.routeId || result.routeId || null,
      actualMode: result.mode,
      requestFormat: result.requestFormat,
      providerName: result.log?.providerName || result.providerId || "未选择",
      modelName: result.log?.modelName || result.modelId || "未选择",
      endpointType: result.endpointType,
      serverStatus: result.serverStatus || result.log?.serverStatus || null,
      providerStatus: result.providerStatus || result.log?.providerStatus || null,
      outputPreview: result.outputText ? String(result.outputText).slice(0, 120) : "",
      routingReason: result.log?.routingReason || "",
      matchedSkillIds: result.matchedSkillIds || [],
      warnings: result.warnings || [],
      requiresRouteFix: result.requiresRouteFix || result.log?.requiresRouteFix || false,
      success: result.success,
      errorMessage: result.error || "",
      createdAt: new Date().toISOString()
    };
    if (result.log) state.modelLogs = [result.log, ...state.modelLogs].slice(0, 80);
    return state;
  }, "测试当前任务路由", { targetType: "settings", action: "generate", light: true });
  busyAction = null;
  showToast(result.success ? "当前任务路由轻量测试完成" : `当前任务路由测试失败：${result.error || "未知错误"}`);
}

async function switchCoreTasksToSelectedModel() {
  const current = store.getState();
  const modelId =
    document.querySelector("#current-selected-model")?.value ||
    document.querySelector("#global-default-model")?.value ||
    current.apiConfig.selectedModelId;
  const model = current.apiConfig.models.find((item) => item.id === modelId);
  const provider = current.apiConfig.providers.find((item) => item.id === model?.providerId);
  if (!model || !provider || provider.providerType === "local") {
    showToast("请先在模型列表中选择一个真实模型");
    return;
  }
  store.setState((state) => {
    state.apiConfig = switchCoreRoutesToModel(state.apiConfig, model.id);
    state.apiConfig.selectedModelId = model.id;
    state.mode = "api";
    state.apiConfig.updatedAt = new Date().toISOString();
    return state;
  }, "一键切换核心任务到当前真实模型", { targetType: "settings", action: "edit", light: true });
  await syncApiSettings({ successMessage: "已将核心任务路由切换到当前真实模型，并同步到本地服务。" });
}

function addRoute() {
  const route = createRouteDraft(store.getState().apiConfig.selectedModelId);
  store.setState((state) => {
    state.apiConfig.routes = [route, ...state.apiConfig.routes];
    state.apiConfig.selectedRouteId = route.id;
    return state;
  }, "新增模型路由", { targetType: "settings", action: "generate", light: true });
}

async function saveRoute(routeId) {
  store.setState((state) => {
    state.apiConfig.routes = state.apiConfig.routes.map((route) =>
      route.id === routeId
        ? {
            ...route,
            featureArea: readRouteField("featureArea"),
            taskType: readRouteField("taskType"),
            primaryModelId: readRouteField("primaryModelId"),
            fallbackModelIds: parseCsv(readRouteField("fallbackModelIds")),
            requiredCapabilities: parseCsv(readRouteField("requiredCapabilities")),
            maxInputTokens: Number(readRouteField("maxInputTokens")) || 24000,
            maxOutputTokens: Number(readRouteField("maxOutputTokens")) || 4096,
            temperature: Number(readRouteField("temperature")) || 0,
            topP: Number(readRouteField("topP")) || 1,
            jsonModeRequired: document.querySelector('[data-route-field="jsonModeRequired"]')?.checked || false,
            streamingEnabled: document.querySelector('[data-route-field="streamingEnabled"]')?.checked || false,
            allowFallback: document.querySelector('[data-route-field="allowFallback"]')?.checked || false,
            enabled: document.querySelector('[data-route-field="enabled"]')?.checked || false,
            retryCount: Number(readRouteField("retryCount")) || 0,
            timeoutMs: Number(readRouteField("timeoutMs")) || 60000,
            notes: readRouteField("notes"),
            updatedAt: new Date().toISOString()
          }
        : route
    );
    state.apiConfig.updatedAt = new Date().toISOString();
    return state;
  }, "保存模型路由", { targetType: "settings", action: "edit", light: true });
  await syncApiSettings();
}

function addFeedback() {
  const comment = document.querySelector("#feedback-comment")?.value || "";
  const rating = Number(document.querySelector("#feedback-rating")?.value || 4);
  if (!comment.trim()) {
    showToast("请先填写反馈内容");
    return;
  }
  store.setState((state) => {
    state.currentProject.feedback = [
      {
        id: `feedback-${Date.now().toString(36)}`,
        projectId: state.currentProject.id,
        targetType: document.querySelector("#feedback-target")?.value || "outline",
        targetId: state.currentProject.id,
        feedbackType: document.querySelector("#feedback-type")?.value || "主编评价反馈",
        rating,
        comment,
        before: "",
        after: "",
        outcomeData: null,
        suggestedSkillUpdate: rating < 4 ? "建议检查相关 Skill 是否需要补充规则。" : "可沉淀为高表现结构经验。",
        createdAt: new Date().toISOString()
      },
      ...(state.currentProject.feedback || [])
    ];
    return state;
  }, "新增反馈回流记录", { targetType: "feedback", action: "generate" });
}

function render() {
  const state = store.getState();
  root.innerHTML = `
    <div class="app-shell">
      ${renderSidebar(state)}
      <section class="workspace">
        ${renderTopbar(state)}
        <main class="main-grid">
          <section class="content-surface">${renderMain(state)}</section>
          <aside class="inspector">${renderInspector(state)}</aside>
        </main>
      </section>
      ${busyAction ? `<div class="busy"><div class="busy-box"><span class="spinner"></span>${escapeHtml(busyAction)}进行中...</div></div>` : ""}
      ${toast ? `<div class="toast">${escapeHtml(toast)}</div>` : ""}
    </div>
  `;
}

function renderSidebar(state) {
  const modeLabel = state.apiConfig?.mode === "api" ? "真实 API Mode" : "Demo Mode";
  const modeDesc = state.apiConfig?.mode === "api" ? "失败不会静默切 Demo" : "规则引擎演示，不冒充真实 API";
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">剧</div>
        <div>
          <strong>结构工作台</strong>
          <span>Script OS V1</span>
        </div>
      </div>
      <nav class="nav-list">
        ${navItems
          .map(
            (item) => `
          <button class="nav-item ${state.view === item.id ? "active" : ""}" data-view="${item.id}">
            ${icon(item.icon)}
            <span>${item.label}</span>
          </button>`
          )
          .join("")}
      </nav>
      <div class="sidebar-foot">
        <span class="mode-dot"></span>
        <div>
          <strong>${modeLabel}</strong>
          <span>${modeDesc}</span>
        </div>
      </div>
    </aside>
  `;
}

function renderTopbar(state) {
  const project = state.currentProject;
  const model = state.apiConfig?.models?.find((item) => item.id === state.apiConfig.globalDefaultModelId);
  return `
    <header class="topbar">
      <div>
        <input id="project-title" class="project-title" value="${escapeAttr(project.title)}" aria-label="项目名" />
        <div class="top-meta">
          <span>${escapeHtml(project.status)}</span>
          <span>${escapeHtml(state.saveStatus)}</span>
          <span>模式：${state.apiConfig?.mode === "api" ? "真实 API" : "Demo"}</span>
          <span>模型：${escapeHtml(model?.displayName || "DemoRuleEngine-v1")}</span>
          <span>Skill：${escapeHtml(activeSkillSummary(state))}</span>
        </div>
      </div>
      <div class="top-actions">
        ${state.lastExport?.href ? `<a class="ghost-link" href="${state.lastExport.href}" target="_blank" rel="noreferrer">查看最近导出</a>` : ""}
        <button class="icon-button" data-action="export-json" title="导出完整 JSON">${icon("download")}</button>
        <button class="primary-button" data-action="freeze-project">${icon("lock")}冻结快照</button>
      </div>
    </header>
  `;
}

function renderMain(state) {
  const views = {
    home: renderHome,
    analysis: renderAnalysis,
    cases: renderCases,
    assets: renderAssets,
    skills: renderSkills,
    decision: renderDecision,
    outline: renderOutline,
    draft: renderDraft,
    audit: renderAudit,
    feedback: renderFeedback,
    settings: renderSettings
  };
  return (views[state.view] || renderHome)(state);
}

function renderHome(state) {
  const project = state.currentProject;
  return `
    <section class="page-head">
      <div>
        <h1>AI 剧本结构学习与细纲生产系统</h1>
        <p>从成功剧本拆解，到模式沉淀、创作决策、锁定锚点、细纲生产、审计修复和导出。</p>
      </div>
      <div class="head-actions">
        <button class="secondary-button" data-view="analysis">${icon("scan")}分析剧本</button>
        <button class="primary-button" data-view="decision">${icon("compass")}进入创作决策</button>
      </div>
    </section>
    <section class="metric-row">
      ${metric("案例库", state.cases.length, "可检索结构档案")}
      ${metric("模式资产", Object.values(state.assets).flat().length, "可复用题材/节奏/反差")}
      ${metric("Skill 版本", state.skills.length, "可测试、启用、回滚")}
      ${metric("模型调用", state.modelLogs.length, "记录任务、耗时、摘要")}
    </section>
    <section class="flow-board">
      ${[
        ["剧本分析", "拆解主题、人物、节奏、金手指、分集功能。", state.currentAnalysis ? "done" : "ready"],
        ["案例与模式沉淀", "保存案例，提炼可复用结构资产。", state.cases.length > 1 ? "done" : "ready"],
        ["创作决策", "生成方向、主题、大反差、结局和大节点。", project.lockedTheme ? "done" : "ready"],
        ["锁定锚点", "人类确认关键判断，后续生成不得覆盖。", Object.values(project.locks).some(Boolean) ? "done" : "ready"],
        ["细纲生产", "生成宏观结构、阶段大纲和分集细纲。", project.episodeOutline.length ? "done" : "ready"],
        ["审计修复导出", "独立审计弱集，局部修复并导出 Markdown。", project.auditReport ? "done" : "ready"]
      ]
        .map(
          ([title, desc, status], index) => `
          <article class="flow-card ${status}">
            <span>${index + 1}</span>
            <h3>${title}</h3>
            <p>${desc}</p>
          </article>`
        )
        .join("")}
    </section>
    <section class="two-column">
      <div class="panel">
        <div class="panel-title">
          <h2>当前项目锚点</h2>
          <button class="small-button" data-view="decision">编辑</button>
        </div>
        ${renderAnchorSummary(project)}
      </div>
      <div class="panel">
        <div class="panel-title">
          <h2>最近风险</h2>
          <button class="small-button" data-action="audit-outline">重新审计</button>
        </div>
        ${renderRiskList(project)}
      </div>
    </section>
  `;
}

function renderAnalysis(state) {
  const input = state.scriptInput;
  const analysis = state.currentAnalysis;
  return `
    <section class="page-head compact">
      <div>
        <h1>剧本分析中心</h1>
        <p>重点不是总结剧情，而是拆出结构价值、观众情绪、人物承载、金手指规则和分集功能。</p>
      </div>
      <button class="primary-button" data-action="analyze-script">${icon("spark")}开始分析</button>
    </section>
    <section class="analysis-input">
      <div class="form-grid">
        <label>剧本标题<input id="script-title" value="${escapeAttr(input.title)}" /></label>
        <label>题材备注<input id="script-genre" value="${escapeAttr(input.genre)}" /></label>
        <label>集数<input id="script-episode-count" type="number" min="1" value="${input.episodeCount}" /></label>
        <label>分析粒度
          <select id="script-granularity">
            ${["简要", "标准", "深度"].map((item) => `<option ${input.granularity === item ? "selected" : ""}>${item}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="upload-row">
        <label class="file-button">${icon("upload")}上传 txt / md / docx<input id="script-file" type="file" accept=".txt,.md,.docx,.doc,.pdf" /></label>
        <span>已支持 .docx 正文解析；老式 .doc 和 PDF 会提示转换，避免乱码。</span>
      </div>
      <textarea id="script-text" class="large-textarea" spellcheck="false">${escapeHtml(input.text)}</textarea>
    </section>
    ${
      analysis
        ? `
      <section class="tabbar">
        ${analysisTabs.map(([id, label]) => `<button class="${state.activeAnalysisTab === id ? "active" : ""}" data-action="set-analysis-tab" data-id="${id}">${label}</button>`).join("")}
      </section>
      <section class="panel result-panel">
        ${renderAnalysisSourceAlert(analysis)}
        ${renderAnalysisTab(analysis, state.activeAnalysisTab)}
        <div class="panel-actions">
          <button class="secondary-button" data-action="save-case">${icon("archive")}加入案例库</button>
          <button class="secondary-button" data-action="export-analysis">${icon("download")}导出分析报告</button>
        </div>
      </section>`
        : emptyState("还没有分析结果", "粘贴或上传剧本后点击开始分析，系统会输出结构档案而不是剧情摘要。")
    }
  `;
}

function renderAnalysisSourceAlert(analysis) {
  const meta = analysis?.sourceMeta;
  if (!meta?.needsReview && !meta?.blockedSave) return "";
  const rows = [
    meta.unwrapPath?.length ? `已展开 ${meta.unwrapPath.join(".")} 外层` : "",
    meta.missingCoreSections?.length ? `真实模型缺少 ${meta.missingCoreSections.length} 个核心模块：${meta.missingCoreSections.join("、")}` : "",
    meta.localFallbackSections?.length ? `${meta.localFallbackSections.length} 个模块由本地规则补齐` : "",
    meta.modelCompletenessScore !== undefined ? `模型结构完整度：${meta.modelCompletenessScore}%` : ""
  ].filter(Boolean);
  return `
    <div class="analysis-source-alert ${meta.blockedSave ? "blocked" : ""}">
      <strong>${meta.blockedSave ? "该分析仅可作为待复核草稿" : "本次分析使用了结构修复/字段补齐"}</strong>
      <p>${escapeHtml(rows.join("；") || "真实模型输出结构与标准档案不完全一致。")}</p>
      ${
        meta.blockedSave
          ? `<p>已阻止直接加入正式案例库。请重新分析或执行结构修复后再沉淀为案例。</p>`
          : `<p>建议主编复核后再加入案例库或提炼 Skill。</p>`
      }
    </div>
  `;
}

function renderAnalysisTab(analysis, tab) {
  const map = {
    overview: () => `
      <div class="score-strip">
        ${scoreCard("钩子强度", analysis.hookAnalysis.hookStrengthScore)}
        ${scoreCard("情绪需求", analysis.audienceNeedAnalysis.emotionalNeedScore)}
        ${scoreCard("主题承载", analysis.themeAnalysis.themeStrengthScore)}
        ${scoreCard("主线强度", analysis.mainlineStructure.mainlineStrengthScore)}
      </div>
      ${keyValueGrid([
        ["题材", analysis.basicInfo.genre.join("、")],
        ["目标用户", analysis.basicInfo.targetAudience],
        ["核心看点", analysis.basicInfo.coreAppeal],
        ["商业定位", analysis.basicInfo.commercialPositioning],
        ["结构信心", `${Math.round(analysis.confidence * 100)}%`]
      ])}`,
    hook: () => renderObjectSection("开头钩子分析", analysis.hookAnalysis),
    emotion: () => renderObjectSection("观众情绪需求分析", analysis.audienceNeedAnalysis),
    theme: () => renderObjectSection("主题层分析", analysis.themeAnalysis),
    characters: () => `
      <h2>人物核心分析</h2>
      <div class="card-grid">
        ${[analysis.characterAnalysis.protagonist, ...analysis.characterAnalysis.mainCharacters].map(renderCharacterCard).join("")}
      </div>
      <h3>关系边</h3>
      ${analysis.characterAnalysis.relationshipEdges.map((edge) => `<div class="relation-row"><strong>${edge.from} → ${edge.to}</strong><span>${edge.relationshipShift}</span><span>${edge.themeFunction}</span></div>`).join("")}`,
    goldfinger: () => `${renderObjectSection("金手指分析", analysis.goldfingerAnalysis)}${renderObjectSection("阻碍系统", analysis.obstacleAnalysis)}`,
    mainline: () => `
      ${renderObjectSection("主线骨架", analysis.mainlineStructure, ["stageStructure"])}
      <div class="stage-list">${analysis.mainlineStructure.stageStructure.map(renderStageMini).join("")}</div>`,
    reversal: () => renderObjectSection("主线大反差分析", analysis.mainlineReversalAnalysis),
    ending: () => renderObjectSection("结局与情绪兑现分析", analysis.endingAnalysis),
    episodes: () => `<div class="episode-table">${analysis.episodeFunctionAnalysis.map(renderEpisodeFunctionRow).join("")}</div>`,
    patterns: () => `<div class="card-grid">${analysis.reusablePatterns.map(renderPatternCard).join("")}</div>`
  };
  return (map[tab] || map.overview)();
}

function renderCases(state) {
  return `
    <section class="page-head compact">
      <div>
        <h1>案例库</h1>
        <p>保存所有结构分析结果，按题材、情绪需求、钩子、金手指和主线大反差检索。</p>
      </div>
      <button class="secondary-button" data-action="save-case">${icon("archive")}保存当前分析</button>
    </section>
    <section class="case-list">
      ${state.cases.map(renderCaseItem).join("")}
    </section>
  `;
}

function renderAssets(state) {
  const category = state.activeAssetCategory || "audienceNeeds";
  const list = state.assets[category] || [];
  return `
    <section class="page-head compact">
      <div>
        <h1>模式资产中心</h1>
        <p>把成功剧本拆解结果沉淀成可调用的题材、情绪、钩子、骨架、金手指、节奏和结局资产。</p>
      </div>
    </section>
    <section class="asset-layout">
      <div class="asset-tabs">
        ${assetCategories.map(([id, label]) => `<button class="${category === id ? "active" : ""}" data-action="set-asset-category" data-id="${id}">${label}</button>`).join("")}
      </div>
      <div class="asset-cards">
        ${list.map(renderAssetCard).join("")}
      </div>
    </section>
  `;
}

function renderSkills(state) {
  const selected = state.skills.find((item) => item.id === state.selectedSkillId) || state.skills[0];
  const filtered = filterSkills(state.skills, state.skillFilters || {});
  return `
    <section class="page-head compact">
      <div>
        <h1>Skill 进化中心</h1>
        <p>管理可编辑 Skill 资产：范围、规则、Prompt 补充、正反例、评估标准、风险、模型偏好和版本记录。</p>
      </div>
      <button class="primary-button" data-action="add-skill">${icon("spark")}新增 Skill</button>
    </section>
    <section class="skill-layout">
      <div class="skill-list">
        <div class="skill-filter-box">
          <label>功能筛选
            <select id="skill-filter-function">
              ${["全部", ...functionalSkillTypes].map((item) => `<option ${state.skillFilters?.function === item ? "selected" : ""}>${item}</option>`).join("")}
            </select>
          </label>
          <label>题材筛选
            <select id="skill-filter-genre">
              ${["全部", ...genreSkillTypes].map((item) => `<option ${state.skillFilters?.genre === item ? "selected" : ""}>${item}</option>`).join("")}
            </select>
          </label>
          <label>情绪筛选
            <select id="skill-filter-audience">
              ${["全部", ...audienceNeedSkillTypes].map((item) => `<option ${state.skillFilters?.audience === item ? "selected" : ""}>${item}</option>`).join("")}
            </select>
          </label>
          <label>状态筛选
            <select id="skill-filter-status">
              ${["全部", ...skillStatuses].map((item) => `<option ${state.skillFilters?.status === item ? "selected" : ""}>${item}</option>`).join("")}
            </select>
          </label>
          <button class="secondary-button" data-action="apply-skill-filters">应用筛选</button>
        </div>
        ${filtered
          .map(
            (skill) => `
          <button class="skill-row ${selected?.id === skill.id ? "active" : ""}" data-action="select-skill" data-id="${skill.id}">
            <strong>${skill.name}</strong>
            <span>${skill.skillType}｜${skill.version}｜${skill.status}｜优先级 ${skill.priority}</span>
          </button>`
          )
          .join("")}
      </div>
      <div class="skill-editor">
        ${selected ? renderSkillDetail(selected, state) : emptyState("暂无 Skill", "创建或导入规则后可在这里管理。")}
      </div>
      <div class="skill-side">
        ${selected ? renderSkillSidePanel(selected, state) : ""}
      </div>
    </section>
  `;
}

function renderDecision(state) {
  const project = state.currentProject;
  return `
    <section class="page-head compact">
      <div>
        <h1>创作决策中心</h1>
        <p>AI 先给可能性和评估，人类再锁定方向、主题、大反差、结局和大节点。</p>
      </div>
      <button class="primary-button" data-action="evaluate-idea">${icon("spark")}评估创意</button>
    </section>
    <section class="decision-input panel">
      <div class="form-grid three">
        <label>项目集数<input id="project-episode-count" type="number" min="1" value="${project.creativeConstraints.episodeCount}" /></label>
        <label>目标用户<input id="project-target-audience" value="${escapeAttr(project.creativeConstraints.targetAudience)}" /></label>
        <label>风格语气<input id="project-tone" value="${escapeAttr(project.creativeConstraints.tone)}" /></label>
      </div>
      <label class="block-label">原始创意<textarea id="idea-text" class="medium-textarea">${escapeHtml(project.creativeInput)}</textarea></label>
      <div class="panel-actions">
        <button class="secondary-button" data-action="generate-directions">${icon("compass")}生成 5 类方向</button>
        <button class="secondary-button" data-action="generate-themes">${icon("spark")}生成主题与情绪</button>
        <button class="secondary-button" data-action="generate-reversals">${icon("layers")}生成主线大反差</button>
        <button class="secondary-button" data-action="generate-ending-nodes">${icon("list")}生成结局与大节点</button>
      </div>
    </section>
    ${project.ideaEvaluation ? renderIdeaEvaluation(project.ideaEvaluation) : ""}
    ${renderDirectionCandidates(project)}
    ${renderThemeCandidates(project)}
    ${renderReversalCandidates(project)}
    ${renderEndingAndNodes(project)}
  `;
}

function renderOutline(state) {
  const project = state.currentProject;
  const selected = project.episodeOutline.find((item) => item.episodeNo === state.selectedEpisodeNo) || project.episodeOutline[0];
  return `
    <section class="page-head compact">
      <div>
        <h1>细纲生产中心</h1>
        <p>基于已锁定锚点、案例库、模式库和 Skill 生成宏观结构、阶段大纲和分集细纲。</p>
      </div>
      <button class="primary-button" data-action="generate-outline">${icon("list")}生成宏观结构与分集细纲</button>
    </section>
    <section class="lock-check panel">
      ${renderPreconditionLocks(project)}
    </section>
    ${project.macroOutline ? renderMacroOutline(project.macroOutline) : emptyState("还没有宏观结构", "先在创作决策中心生成并锁定关键锚点，再生成细纲。")}
    ${project.stageOutline?.length ? `<section class="panel"><div class="panel-title"><h2>阶段大纲</h2><button class="small-button" data-action="lock-outline">${icon("lock")}锁定细纲</button></div><div class="stage-list">${project.stageOutline.map(renderStageOutlineCard).join("")}</div></section>` : ""}
    ${
      project.episodeOutline?.length
        ? `<section class="outline-grid">
            <div class="episode-rail">${project.episodeOutline.map((episode) => renderEpisodeOutlineCard(episode, state.selectedEpisodeNo)).join("")}</div>
            <div class="panel sticky-editor">${selected ? renderEpisodeEditor(selected) : ""}</div>
          </section>`
        : ""
    }
  `;
}

function renderDraft(state) {
  const project = state.currentProject;
  const selected = project.draftEpisodes.find((item) => item.episodeNo === state.selectedEpisodeNo);
  const hasOutline = project.episodeOutline.length > 0;
  return `
    <section class="page-head compact">
      <div>
        <h1>成稿中心</h1>
        <p>基于已确认分集细纲生成单集成稿。V1 保持短剧/漫剧文本格式和成稿审计。</p>
      </div>
      <button class="primary-button" ${hasOutline ? "" : "disabled"} data-action="generate-draft" data-no="${state.selectedEpisodeNo}">${icon("pen")}生成选中集成稿</button>
    </section>
    ${hasOutline ? renderEpisodePicker(project, state.selectedEpisodeNo) : emptyState("请先生成分集细纲", "成稿必须严格基于已确认细纲。")}
    ${
      selected
        ? `<section class="panel">
            <div class="panel-title">
              <h2>${selected.title}</h2>
              <div>
                <button class="small-button" data-action="audit-draft" data-no="${selected.episodeNo}">成稿审计</button>
                <button class="small-button" data-action="export-draft">导出成稿</button>
              </div>
            </div>
            ${selected.sceneList.map(renderSceneDraft).join("")}
            ${selected.draftAudit ? renderDraftAudit(selected.draftAudit) : ""}
          </section>`
        : emptyState("暂无成稿", "选择一集后点击生成成稿。")
    }
  `;
}

function renderAudit(state) {
  const project = state.currentProject;
  const audit = project.auditReport;
  return `
    <section class="page-head compact">
      <div>
        <h1>审计与局部修复</h1>
        <p>审计独立于生成，用于发现主题、人物、情绪、伏笔、节奏、逻辑和悬念问题。</p>
      </div>
      <button class="primary-button" data-action="audit-outline">${icon("shield")}运行细纲审计</button>
    </section>
    ${
      audit
        ? `<section class="audit-board">
            <div class="panel">
              <div class="audit-score"><span>${audit.overallScore}</span><strong>结构总分</strong><p>${audit.summary}</p></div>
              <div class="score-strip">
                ${scoreCard("主题一致", audit.themeAudit.score)}
                ${scoreCard("人物服务", audit.characterAudit.score)}
                ${scoreCard("大反差", audit.reversalAudit.score)}
                ${scoreCard("分集功能", audit.episodeAudit.score)}
              </div>
            </div>
            <div class="panel">
              <div class="panel-title"><h2>弱集问题</h2><button class="small-button" data-action="export-audit">导出审计报告</button></div>
              <div class="issue-list">${audit.episodeAudit.episodeIssues.map(renderIssueRow).join("") || "<p class='muted'>暂无问题。</p>"}</div>
            </div>
            <div class="panel">
              <h2>修复记录</h2>
              ${project.repairs.length ? project.repairs.map(renderRepairItem).join("") : "<p class='muted'>暂无局部修复记录。</p>"}
            </div>
          </section>`
        : emptyState("还没有审计结果", "生成细纲后运行审计，系统会标记弱集并给出局部修复动作。")
    }
  `;
}

function renderFeedback(state) {
  const feedback = state.currentProject.feedback || [];
  return `
    <section class="page-head compact">
      <div>
        <h1>反馈回流</h1>
        <p>把人工修改、主编评价、成稿结果和上线数据转成可追踪的 Skill 优化素材。</p>
      </div>
    </section>
    <section class="panel">
      <div class="form-grid four">
        <label>反馈目标
          <select id="feedback-target">
            ${["outline", "episode", "draft", "skill", "pattern"].map((item) => `<option>${item}</option>`).join("")}
          </select>
        </label>
        <label>反馈类型
          <select id="feedback-type">
            ${["人工修改反馈", "主编评价反馈", "成稿通过/驳回反馈", "上线播放数据反馈", "平台审核反馈"].map((item) => `<option>${item}</option>`).join("")}
          </select>
        </label>
        <label>评分<input id="feedback-rating" type="number" min="1" max="5" value="4" /></label>
        <div class="form-action"><button class="primary-button" data-action="add-feedback">写入回流</button></div>
      </div>
      <textarea id="feedback-comment" class="medium-textarea" placeholder="例如：第 9 集爽点成立，但人物变化不足，建议 Skill 强制补人物误判或关系变化。"></textarea>
    </section>
    <section class="timeline-list">
      ${feedback.map((item) => `<article><strong>${item.feedbackType}｜${item.rating} 分</strong><p>${item.comment}</p><span>${formatDate(item.createdAt)}｜${item.suggestedSkillUpdate}</span></article>`).join("") || emptyState("暂无反馈", "写入反馈后，可作为 Skill 优化建议来源。")}
    </section>
  `;
}

function renderSettings(state) {
  const tab = state.apiConfig?.activeSettingsTab || "status";
  const tabs = [
    ["status", "基础状态"],
    ["providers", "API Provider"],
    ["models", "模型列表"],
    ["routes", "路由配置"],
    ["logs", "调用日志"],
    ["security", "安全说明"]
  ];
  return `
    <section class="page-head compact">
      <div>
        <h1>系统设置</h1>
        <p>配置 Demo Mode、真实 API Provider、模型列表、任务路由、调用日志和本地密钥安全边界。</p>
      </div>
      <button class="danger-button" data-action="reset">重置 Demo 数据</button>
    </section>
    <section class="tabbar settings-tabs">
      ${tabs.map(([id, label]) => `<button class="${tab === id ? "active" : ""}" data-action="set-settings-tab" data-id="${id}">${label}</button>`).join("")}
    </section>
    ${renderSettingsTab(state, tab)}
  `;
}

function renderSettingsTab(state, tab) {
  const config = state.apiConfig;
  const views = {
    status: () => renderApiStatus(state),
    providers: () => renderProviderSettings(config),
    models: () => renderModelSettings(config),
    routes: () => renderRouteSettings(config),
    logs: () => renderModelLogs(state),
    security: () => renderSecurityNotes()
  };
  return (views[tab] || views.status)();
}

function renderApiStatus(state) {
  const config = state.apiConfig;
  const demoWarnings = getApiModeDemoRouteWarnings(config);
  const routeTestTask = config.routeTestTaskType || config.routes.find((route) => route.id === config.selectedRouteId)?.taskType || "analyzeScript";
  const selectedModelId = config.selectedModelId || config.globalDefaultModelId || config.models[0]?.id || "";
  return `
    <section class="two-column">
      <div class="panel">
        <h2>基础状态</h2>
        <div class="form-grid two">
          <label>运行模式
            <select id="api-mode">
              <option value="demo" ${config.mode === "demo" ? "selected" : ""}>Demo Mode</option>
              <option value="api" ${config.mode === "api" ? "selected" : ""}>真实 API Mode</option>
            </select>
          </label>
          <label>全局默认模型
            <select id="global-default-model">
              ${config.models.map((model) => `<option value="${model.id}" ${config.globalDefaultModelId === model.id ? "selected" : ""}>${model.displayName}</option>`).join("")}
            </select>
          </label>
          <label>API Mode 允许 Demo 兜底
            <input id="allow-demo-in-api-mode" type="checkbox" ${config.allowDemoInApiMode ? "checked" : ""} />
          </label>
        </div>
        <div class="panel-actions"><button class="primary-button" data-action="set-api-mode">保存基础状态</button></div>
        ${keyValueGrid([
          ["Provider 数量", config.providers.length],
          ["启用模型", config.models.filter((model) => model.enabled).length],
          ["任务路由", config.routes.length],
          ["调用记录", "data/logs/model-calls.jsonl"]
        ])}
      </div>
      <div class="panel">
        <h2>测试当前任务路由</h2>
        <div class="form-grid two">
          <label>任务类型
            <select id="route-test-task">
              ${modelTaskTypes.map((taskType) => `<option value="${taskType}" ${routeTestTask === taskType ? "selected" : ""}>${taskType}</option>`).join("")}
            </select>
          </label>
          <label>当前选中模型
            <select id="current-selected-model">
              ${config.models.map((model) => `<option value="${model.id}" ${selectedModelId === model.id ? "selected" : ""}>${escapeHtml(model.displayName)}｜${escapeHtml(providerNameForModel(config, model))}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="panel-actions">
          <button class="secondary-button" data-action="test-task-route">轻量测试当前任务路由</button>
          <button class="primary-button" data-action="switch-core-routes">一键切换核心任务到当前真实模型</button>
        </div>
        ${renderRouteTestResult(config.lastRouteTestResult)}
      </div>
    </section>
    <section class="panel notice-panel">
      <strong>${config.mode === "api" ? "真实 API Mode" : "Demo Mode"}</strong>
      <p>${config.mode === "api" ? "真实 API 调用失败时不会静默切到 Demo；任务路由仍指向 Demo 时默认阻断，只有手动允许 Demo 兜底才会继续生成。" : "当前使用 DemoRuleEngine-v1，所有结果来自本地规则引擎演示，不冒充真实 API。"}</p>
      ${
        config.mode === "api" && config.allowDemoInApiMode
          ? `<div class="warning-list strong-warning"><p>当前真实 API Mode 允许 Demo 兜底，部分任务可能不会调用真实模型。</p></div>`
          : ""
      }
      ${
        config.lastSettingsSync
          ? `<p class="${config.lastSettingsSync.success ? "sync-ok" : "warning-text"}">${escapeHtml(config.lastSettingsSync.message)} ${formatDate(config.lastSettingsSync.createdAt)}</p>`
          : ""
      }
      ${
        demoWarnings.length
          ? `<div class="warning-list">${demoWarnings.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>`
          : ""
      }
    </section>
  `;
}

function renderRouteTestResult(result) {
  if (!result) return "<p class='muted'>选择任务后点击轻量测试，只验证路由选择与服务端 Provider 链路，不会运行完整剧本分析。</p>";
  return `
    <div class="suggestion-box ${result.success ? "" : "has-warning"}">
      <h3>最近路由测试</h3>
      ${keyValueGrid([
        ["任务", result.taskType],
        ["Route", result.routeId || "未匹配"],
        ["实际模式", result.actualMode],
        ["请求格式", result.requestFormat || "未记录"],
        ["Provider", result.providerName],
        ["模型", result.modelName],
        ["端点类型", result.endpointType || "未记录"],
        ["服务端状态", result.serverStatus || "未记录"],
        ["Provider 状态", result.providerStatus || "未记录"],
        ["路由原因", result.routingReason || "未记录"],
        ["探针输出", result.outputPreview || "无"],
        ["Skill", (result.matchedSkillIds || []).join("、") || "无"],
        ["警告", (result.warnings || []).join("；") || "无"],
        ["需要修正路由", result.requiresRouteFix ? "是" : "否"],
        ["错误", result.errorMessage || "无"],
        ["时间", formatDate(result.createdAt)]
      ])}
      ${
        result.actualMode === "demo"
          ? `<p class="warning-text">API 已配置，但该任务仍指向 Demo，请点击一键切换核心任务到当前真实模型。</p>`
          : ""
      }
    </div>
  `;
}

function renderProviderSettings(config) {
  const selected = config.providers.find((provider) => provider.id === config.selectedProviderId) || config.providers[0];
  return `
    <section class="settings-split">
      <div class="panel">
        <div class="panel-title"><h2>API Provider</h2><button class="small-button" data-action="add-provider">新增</button></div>
        <div class="panel-actions compact-actions">
          <button class="secondary-button" data-action="add-provider-template" data-template="deepseek">DeepSeek 官方模板</button>
          <button class="secondary-button" data-action="add-provider-template" data-template="openai_proxy">OpenAI 代理模板</button>
        </div>
        ${config.providers.map((provider) => `<button class="list-row ${selected?.id === provider.id ? "active" : ""}" data-action="select-provider" data-id="${provider.id}"><strong>${escapeHtml(provider.name)}</strong><span>${provider.providerType}｜${provider.requestFormat || "auto"}｜${provider.enabled ? "启用" : "停用"}｜Key ${maskApiKey(provider.apiKey)}</span></button>`).join("")}
      </div>
      <div class="panel">
        ${selected ? renderProviderForm(selected) : emptyState("暂无 Provider", "新增 Provider 后可配置 Base URL 与 API Key。")}
        ${config.lastTestResult ? `<div class="suggestion-box ${config.lastTestResult.mode === "demo" ? "has-warning" : ""}"><h3>最近测试</h3>${keyValueGrid([["结果", config.lastTestResult.success ? "成功" : "失败"], ["模式", config.lastTestResult.mode || "未记录"], ["端点", config.lastTestResult.endpointType || "未记录"], ["请求格式", config.lastTestResult.requestFormat || "auto"], ["服务端状态", config.lastTestResult.serverStatus || "未记录"], ["Provider 状态", config.lastTestResult.providerStatus || "未记录"], ["说明", config.lastTestResult.message], ["Provider 原始预览", config.lastTestResult.providerRawPreview || "未记录"], ["设置同步时间", formatDate(config.lastTestResult.settingsUpdatedAt)], ["时间", formatDate(config.lastTestResult.createdAt)]])}${config.lastTestResult.mode === "demo" ? `<p class="warning-text">这是 Demo Provider 测试，不代表真实 API 可用。</p>` : ""}</div>` : ""}
      </div>
    </section>
  `;
}

function renderProviderForm(provider) {
  return `
    <div class="panel-title"><h2>${escapeHtml(provider.name)}</h2><span class="status-pill">${provider.enabled ? "启用" : "停用"}</span></div>
    <div class="form-grid two">
      <label>名称<input data-provider-field="name" value="${escapeAttr(provider.name)}" /></label>
      <label>Provider 类型
        <select data-provider-field="providerType">${providerTypes.map((type) => `<option value="${type}" ${provider.providerType === type ? "selected" : ""}>${type}</option>`).join("")}</select>
      </label>
      <label>请求格式
        <select data-provider-field="requestFormat">${requestFormatTypes.map((type) => `<option value="${type}" ${(provider.requestFormat || "auto") === type ? "selected" : ""}>${type}</option>`).join("")}</select>
      </label>
      <label>Base URL<input data-provider-field="baseUrl" value="${escapeAttr(provider.baseUrl)}" /></label>
      <label>API Key<input data-provider-field="apiKey" type="password" autocomplete="new-password" data-1p-ignore="true" placeholder="${escapeAttr(maskApiKey(provider.apiKey))}" /></label>
      <label>是否启用<input data-provider-field="enabled" type="checkbox" ${provider.enabled ? "checked" : ""} /></label>
      <label>优先级<input data-provider-field="priority" type="number" value="${provider.priority}" /></label>
      <label>超时时间 ms<input data-provider-field="timeoutMs" type="number" value="${provider.timeoutMs}" /></label>
      <label>限流备注<input data-provider-field="rateLimit" value="${escapeAttr(provider.rateLimit || "")}" /></label>
    </div>
    <label class="block-label">备注<textarea data-provider-field="notes" class="medium-textarea">${escapeHtml(provider.notes || "")}</textarea></label>
    <p class="muted">OpenAI 代理、DeepSeek、OpenRouter、OneAPI/NewAPI 请用 openai_chat。只有官方 Gemini API 或明确 generateContent 接口才用 gemini_native。</p>
    <div class="panel-actions">
      <button class="primary-button" data-action="save-provider" data-id="${provider.id}">保存 Provider</button>
      <button class="secondary-button" data-action="test-provider" data-id="${provider.id}">测试连接</button>
    </div>
  `;
}

function renderModelSettings(config) {
  const selected = config.models.find((model) => model.id === config.selectedModelId) || config.models[0];
  return `
    <section class="settings-split">
      <div class="panel">
        <div class="panel-title"><h2>模型列表</h2><button class="small-button" data-action="add-model">新增</button></div>
        ${config.models.map((model) => `<button class="list-row ${selected?.id === model.id ? "active" : ""}" data-action="select-model" data-id="${model.id}"><strong>${escapeHtml(model.displayName)}</strong><span>${model.modelName}｜${model.enabled ? "启用" : "停用"}｜${model.qualityLevel}</span></button>`).join("")}
      </div>
      <div class="panel">
        ${selected ? renderModelForm(selected, config) : emptyState("暂无模型", "新增模型后可绑定 Provider 与任务能力。")}
      </div>
    </section>
  `;
}

function renderModelForm(model, config) {
  return `
    <div class="panel-title"><h2>${escapeHtml(model.displayName)}</h2><span class="status-pill">${model.enabled ? "启用" : "停用"}</span></div>
    <div class="form-grid three">
      <label>显示名称<input data-model-field="displayName" value="${escapeAttr(model.displayName)}" /></label>
      <label>真实模型名<input data-model-field="modelName" value="${escapeAttr(model.modelName)}" /></label>
      <label>Provider
        <select data-model-field="providerId">${config.providers.map((provider) => `<option value="${provider.id}" ${model.providerId === provider.id ? "selected" : ""}>${provider.name}</option>`).join("")}</select>
      </label>
      <label>是否启用<input data-model-field="enabled" type="checkbox" ${model.enabled ? "checked" : ""} /></label>
      <label>模型能力<input data-model-field="modelType" value="${escapeAttr((model.modelType || []).join("、"))}" /></label>
      <label>上下文长度<input data-model-field="contextWindow" type="number" value="${model.contextWindow}" /></label>
      <label>最大输出 Tokens<input data-model-field="maxOutputTokens" type="number" value="${model.maxOutputTokens}" /></label>
      <label>质量等级<select data-model-field="qualityLevel">${qualityLevels.map((item) => `<option ${model.qualityLevel === item ? "selected" : ""}>${item}</option>`).join("")}</select></label>
      <label>费用等级<input data-model-field="costLevel" value="${escapeAttr(model.costLevel)}" /></label>
      <label>支持 JSON<input data-model-field="supportsJsonMode" type="checkbox" ${model.supportsJsonMode ? "checked" : ""} /></label>
      <label>支持视觉<input data-model-field="supportsVision" type="checkbox" ${model.supportsVision ? "checked" : ""} /></label>
      <label>支持工具<input data-model-field="supportsTools" type="checkbox" ${model.supportsTools ? "checked" : ""} /></label>
      <label>支持流式<input data-model-field="supportsStreaming" type="checkbox" ${model.supportsStreaming ? "checked" : ""} /></label>
    </div>
    <p class="muted">勾选“支持 JSON”即表示该模型或代理明确支持 OpenAI response_format=json_object；不确定时请保持关闭，系统仍会通过 Prompt 要求 JSON。</p>
    <label class="block-label">推荐任务<input data-model-field="recommendedTasks" value="${escapeAttr((model.recommendedTasks || []).join("、"))}" /></label>
    <label class="block-label">备注<textarea data-model-field="notes" class="medium-textarea">${escapeHtml(model.notes || "")}</textarea></label>
    <div class="panel-actions"><button class="primary-button" data-action="save-model" data-id="${model.id}">保存模型</button></div>
  `;
}

function renderRouteSettings(config) {
  const selected = config.routes.find((route) => route.id === config.selectedRouteId) || config.routes[0];
  return `
    <section class="settings-split">
      <div class="panel">
        <div class="panel-title"><h2>任务路由</h2><button class="small-button" data-action="add-route">新增</button></div>
        ${config.routes.map((route) => `<button class="list-row ${selected?.id === route.id ? "active" : ""}" data-action="select-route" data-id="${route.id}"><strong>${escapeHtml(route.taskType)}</strong><span>${route.featureArea}｜主模型 ${route.primaryModelId || "未设"}</span></button>`).join("")}
      </div>
      <div class="panel">
        ${selected ? renderRouteForm(selected, config) : emptyState("暂无路由", "新增任务路由后可为 taskType 绑定模型。")}
      </div>
    </section>
  `;
}

function renderRouteForm(route, config) {
  return `
    <div class="panel-title"><h2>${escapeHtml(route.taskType)}</h2><span class="status-pill">${route.enabled ? "启用" : "停用"}</span></div>
    <div class="form-grid three">
      <label>功能区<select data-route-field="featureArea">${featureAreas.map((area) => `<option ${route.featureArea === area ? "selected" : ""}>${area}</option>`).join("")}</select></label>
      <label>任务类型<select data-route-field="taskType">${modelTaskTypes.map((type) => `<option ${route.taskType === type ? "selected" : ""}>${type}</option>`).join("")}</select></label>
      <label>主模型<select data-route-field="primaryModelId">${config.models.map((model) => `<option value="${model.id}" ${route.primaryModelId === model.id ? "selected" : ""}>${model.displayName}</option>`).join("")}</select></label>
      <label>备用模型 ID<input data-route-field="fallbackModelIds" value="${escapeAttr((route.fallbackModelIds || []).join("、"))}" /></label>
      <label>必需能力<input data-route-field="requiredCapabilities" value="${escapeAttr((route.requiredCapabilities || []).join("、"))}" /></label>
      <label>最大输入 Tokens<input data-route-field="maxInputTokens" type="number" value="${route.maxInputTokens}" /></label>
      <label>最大输出 Tokens<input data-route-field="maxOutputTokens" type="number" value="${route.maxOutputTokens}" /></label>
      <label>temperature<input data-route-field="temperature" type="number" step="0.05" value="${route.temperature}" /></label>
      <label>topP<input data-route-field="topP" type="number" step="0.05" value="${route.topP}" /></label>
      <label>强制 JSON<input data-route-field="jsonModeRequired" type="checkbox" ${route.jsonModeRequired ? "checked" : ""} /></label>
      <label>允许 fallback<input data-route-field="allowFallback" type="checkbox" ${route.allowFallback ? "checked" : ""} /></label>
      <label>启用路由<input data-route-field="enabled" type="checkbox" ${route.enabled ? "checked" : ""} /></label>
      <label>流式<input data-route-field="streamingEnabled" type="checkbox" ${route.streamingEnabled ? "checked" : ""} /></label>
      <label>重试次数<input data-route-field="retryCount" type="number" value="${route.retryCount}" /></label>
      <label>超时 ms<input data-route-field="timeoutMs" type="number" value="${route.timeoutMs}" /></label>
    </div>
    <label class="block-label">备注<textarea data-route-field="notes" class="medium-textarea">${escapeHtml(route.notes || "")}</textarea></label>
    <div class="panel-actions"><button class="primary-button" data-action="save-route" data-id="${route.id}">保存路由</button></div>
  `;
}

function renderModelLogs(state) {
  return `
    <section class="panel">
      <h2>模型调用日志</h2>
      <div class="log-table">
        ${(state.modelLogs || [])
          .map((log) => {
            const demoFallback = log.apiModeDemoFallback || (log.requestedMode === "api" && log.mode === "demo" && !log.requiresRouteFix);
            return `<div class="${log.warnings?.length || demoFallback ? "has-warning" : ""}"><strong>${escapeHtml(log.taskLabel || log.taskType)}</strong><span>${escapeHtml(log.featureArea || "未记录")}</span><span>${escapeHtml(log.providerName || log.providerId || "Demo")}</span><span>${escapeHtml(log.modelName || log.modelId || "未知模型")}</span><span>${escapeHtml(log.requestFormat || log.mode || "未知格式")}</span><span>${escapeHtml(log.endpointType || "未记录")}</span><span>${demoFallback ? "API Mode + Demo 兜底" : log.usedFallback ? "fallback" : "主模型"}</span><span>${(log.matchedSkillIds || []).join("、") || "无"}</span><span>${log.success ? "成功" : "失败"}</span><span>${escapeHtml(log.warnings?.join("；") || log.errorMessage || "")}</span><span>${log.latencyMs} ms</span></div>`;
          })
          .join("") || "<p class='muted'>暂无调用记录。</p>"}
      </div>
    </section>
  `;
}

function renderSecurityNotes() {
  return `
    <section class="panel">
      <h2>安全说明</h2>
      <div class="notice-list">
        <p>API Key 在输入框中以 password 方式录入，页面不会长期明文展示完整 Key。</p>
        <p>本地保存仅用于本机运行，配置会进入 localStorage 和 data/settings，本项目的 .gitignore 已排除本地密钥配置。</p>
        <p>不要把真实 API Key 写入 seed-data.js、README 示例或提交到 GitHub。</p>
        <p>真实 API 调用失败时不会静默切换 Demo；只有任务路由配置的备用真实模型可 fallback，日志会记录 usedFallback。</p>
      </div>
    </section>
  `;
}

function renderInspector(state) {
  const project = state.currentProject;
  const selected = project.episodeOutline.find((item) => item.episodeNo === state.selectedEpisodeNo);
  return `
    <div class="inspector-section">
      <h2>锁定状态</h2>
      <div class="lock-list">
        ${lockItems
          .map(
            ([key, label]) => `
        <div class="${project.locks[key] ? "locked" : ""}">
          <span>${project.locks[key] ? icon("lock") : icon("unlock")}</span>
          <strong>${label}</strong>
        </div>`
          )
          .join("")}
      </div>
    </div>
    <div class="inspector-section">
      <h2>审计提示</h2>
      ${
        project.auditReport
          ? `<div class="mini-score"><span>${project.auditReport.overallScore}</span><p>${project.auditReport.summary}</p></div>`
          : `<p class="muted">生成细纲后运行审计，弱集会出现在这里。</p>`
      }
      ${selected ? `<div class="selected-episode"><strong>选中：第 ${selected.episodeNo} 集</strong><p>${escapeHtml(selected.risks?.join("；") || "暂无风险")}</p></div>` : ""}
    </div>
    <div class="inspector-section">
      <h2>相关模式</h2>
      ${(project.macroOutline?.materialPools?.foreshadowing || state.assets.rhythms || [])
        .slice(0, 3)
        .map((item) => `<article class="mini-card"><strong>${escapeHtml(item.title || item.name)}</strong><p>${escapeHtml(item.description || item.rhythmRule || "")}</p></article>`)
        .join("")}
    </div>
    <div class="inspector-section">
      <h2>版本记录</h2>
      <div class="version-list">
        ${(project.versions || [])
          .slice(0, 8)
          .map((version) => `<div><strong>${version.changeSummary}</strong><span>${formatDate(version.createdAt)}｜${version.action}</span></div>`)
          .join("")}
      </div>
    </div>
  `;
}

function renderAnchorSummary(project) {
  return keyValueGrid([
    ["方向", project.selectedDirection?.title || "未锁定"],
    ["主题", project.lockedTheme?.themeStatement || "未锁定"],
    ["主线大反差", project.lockedMainlineReversal?.title || "未锁定"],
    ["结局", project.lockedEnding?.title || "未锁定"],
    ["大节点", project.lockedMajorNodes?.title || "未锁定"]
  ]);
}

function renderRiskList(project) {
  const issues = project.auditReport?.episodeAudit?.episodeIssues || [];
  if (!issues.length) return "<p class='muted'>暂无审计问题。未审计时不代表没有风险。</p>";
  return issues
    .slice(0, 5)
    .map((issue) => `<div class="risk-row"><strong>第 ${issue.episodeNo} 集｜${issue.issueType}</strong><span>${issue.description}</span></div>`)
    .join("");
}

function renderObjectSection(title, object, skip = []) {
  return `
    <h2>${title}</h2>
    <div class="kv-grid">
      ${Object.entries(object)
        .filter(([key]) => !skip.includes(key))
        .map(([key, value]) => `<div><span>${labelForKey(key)}</span><strong>${formatValue(value)}</strong></div>`)
        .join("")}
    </div>
  `;
}

function renderCharacterCard(character) {
  return `
    <article class="info-card">
      <h3>${character.name}<span>${character.role}</span></h3>
      <p>${character.arcSummary}</p>
      <dl>
        <dt>表层欲望</dt><dd>${character.surfaceDesire}</dd>
        <dt>真正缺失</dt><dd>${character.innerLack}</dd>
        <dt>最大误判</dt><dd>${character.misbelief}</dd>
        <dt>最终选择</dt><dd>${character.finalChoice}</dd>
      </dl>
    </article>
  `;
}

function renderStageMini(stage) {
  return `<article class="stage-card"><strong>${stage.stageNo}. ${stage.title}</strong><p>${stage.stageGoal}</p><span>${stage.episodeRange}｜${stage.endingHook}</span></article>`;
}

function renderStageOutlineCard(stage) {
  return `
    <article class="stage-card">
      <strong>第 ${stage.stageNo} 阶段｜${stage.title}</strong>
      <p>${stage.stageGoal}</p>
      <div class="stage-meta">
        <span>${stage.episodeRange}</span>
        <span>${stage.majorConflict}</span>
        <span>${stage.reversalProgress}</span>
      </div>
    </article>
  `;
}

function renderEpisodeFunctionRow(episode) {
  return `
    <article class="episode-row">
      <strong>${episode.episodeNo}</strong>
      <div>
        <h3>${episode.title}</h3>
        <p>${episode.summary}</p>
        <span>人物：${episode.characterFunction}</span>
        <span>悬念：${episode.cliffhanger}</span>
      </div>
      <em class="${episode.score < 70 ? "warn" : ""}">${episode.score}</em>
    </article>
  `;
}

function renderPatternCard(pattern) {
  return `<article class="info-card"><h3>${pattern.title}<span>${pattern.patternType}</span></h3><p>${pattern.description}</p><dl><dt>为什么有效</dt><dd>${pattern.whyItWorks}</dd><dt>风险</dt><dd>${formatValue(pattern.risks)}</dd></dl></article>`;
}

function renderCaseItem(item) {
  return `
    <article class="case-item">
      <div>
        <h2>${item.title}</h2>
        <p>${item.summary || "暂无摘要"}</p>
        <div class="tag-row">${[...item.genre, ...item.audienceNeeds, ...item.hookTypes].slice(0, 8).map((tag) => `<span>${tag}</span>`).join("")}</div>
      </div>
      <div class="case-score"><strong>${item.qualityScore}</strong><span>${item.status}</span></div>
    </article>
  `;
}

function renderAssetCard(asset) {
  return `
    <article class="asset-card">
      <h2>${asset.name || asset.title}</h2>
      <p>${asset.description || asset.skeletonSummary || asset.rhythmRule || asset.visibleFunction || ""}</p>
      ${keyValueGrid([
        ["适用题材", asset.commonGenres || asset.applicableGenres || asset.genreFit || asset.applicableFormat || "未标注"],
        ["适用情绪", asset.applicableAudienceNeeds || asset.audienceNeedFit || asset.emotionalPayoff || "未标注"],
        ["使用建议", asset.usageGuidance || asset.whyItWorks || asset.revealTimingGuidance || asset.description || "补充中"],
        ["风险", asset.commonRisks || asset.risks || "暂无"]
      ])}
    </article>
  `;
}

function renderSkillDetail(skill, state) {
  const mp = skill.modelPreference || {};
  return `
    <div class="panel skill-form">
      <div class="panel-title">
        <h2>${escapeHtml(skill.name)}</h2>
        <span class="status-pill">${escapeHtml(skill.status)}｜${escapeHtml(skill.source)}</span>
      </div>
      <div class="form-grid three">
        <label>名称<input data-skill-field="name" value="${escapeAttr(skill.name)}" /></label>
        <label>分类
          <select data-skill-field="category">
            ${["按功能", "按题材", "按观众情绪需求", "全局"].map((item) => `<option ${skill.category === item ? "selected" : ""}>${item}</option>`).join("")}
          </select>
        </label>
        <label>Skill 类型<input data-skill-field="skillType" value="${escapeAttr(skill.skillType)}" /></label>
        <label>状态
          <select data-skill-field="status">
            ${skillStatuses.map((item) => `<option ${skill.status === item ? "selected" : ""}>${item}</option>`).join("")}
          </select>
        </label>
        <label>来源
          <select data-skill-field="source">
            ${["system", "admin", "ai_suggestion"].map((item) => `<option ${skill.source === item ? "selected" : ""}>${item}</option>`).join("")}
          </select>
        </label>
        <label>版本<input data-skill-field="version" value="${escapeAttr(skill.version)}" /></label>
        <label>优先级<input data-skill-field="priority" type="number" value="${skill.priority}" /></label>
        <label>输出 Schema<input data-skill-field="outputSchemaRef" value="${escapeAttr(skill.outputSchemaRef)}" /></label>
        <label>更新时间<input value="${escapeAttr(formatDate(skill.updatedAt))}" disabled /></label>
      </div>
      <label class="block-label">描述<textarea data-skill-field="description" class="medium-textarea">${escapeHtml(skill.description)}</textarea></label>
      <div class="form-grid three">
        <label>适用题材<input data-skill-field="genreScope" value="${escapeAttr((skill.genreScope || []).join("、"))}" /></label>
        <label>适用情绪需求<input data-skill-field="audienceNeedScope" value="${escapeAttr((skill.audienceNeedScope || []).join("、"))}" /></label>
        <label>适用平台 / 内容形态<input data-skill-field="platformScope" value="${escapeAttr((skill.platformScope || []).join("、"))}" /></label>
      </div>
      <label class="block-label">适用任务类型<input data-skill-field="taskScope" value="${escapeAttr((skill.taskScope || []).join("、"))}" /></label>
      <div class="form-grid two">
        <label>规则 rules<textarea data-skill-field="rules" class="medium-textarea">${escapeHtml((skill.rules || []).join("\n"))}</textarea></label>
        <label>Prompt 补充段<textarea data-skill-field="promptAdditions" class="medium-textarea">${escapeHtml((skill.promptAdditions || []).join("\n"))}</textarea></label>
        <label>正例 positiveExamples<textarea data-skill-field="positiveExamples" class="medium-textarea">${escapeHtml((skill.positiveExamples || []).join("\n"))}</textarea></label>
        <label>反例 negativeExamples<textarea data-skill-field="negativeExamples" class="medium-textarea">${escapeHtml((skill.negativeExamples || []).join("\n"))}</textarea></label>
        <label>评估标准 evaluationCriteria<textarea data-skill-field="evaluationCriteria" class="medium-textarea">${escapeHtml((skill.evaluationCriteria || []).join("\n"))}</textarea></label>
        <label>风险提示 riskWarnings<textarea data-skill-field="riskWarnings" class="medium-textarea">${escapeHtml((skill.riskWarnings || []).join("\n"))}</textarea></label>
      </div>
      <h3>模型偏好</h3>
      <div class="form-grid three">
        <label>推荐模型 ID<input data-skill-model="preferredModelIds" value="${escapeAttr((mp.preferredModelIds || []).join("、"))}" /></label>
        <label>禁用模型 ID<input data-skill-model="forbiddenModelIds" value="${escapeAttr((mp.forbiddenModelIds || []).join("、"))}" /></label>
        <label>必需能力<input data-skill-model="requireCapabilities" value="${escapeAttr((mp.requireCapabilities || []).join("、"))}" /></label>
        <label>Fallback 策略<input data-skill-model="fallbackStrategy" value="${escapeAttr(mp.fallbackStrategy || "")}" /></label>
        <label>允许 fallback<input data-skill-model="allowFallback" type="checkbox" ${mp.allowFallback === false ? "" : "checked"} /></label>
        <label>模型备注<input data-skill-model="notes" value="${escapeAttr(mp.notes || "")}" /></label>
      </div>
      <div class="panel-actions">
        <button class="primary-button" data-action="save-skill" data-id="${skill.id}">${icon("check")}保存</button>
        <button class="secondary-button" data-action="copy-skill" data-id="${skill.id}">复制</button>
        <button class="secondary-button" data-action="toggle-skill" data-id="${skill.id}">${skill.status === "已启用" ? "停用" : "启用"}</button>
        <button class="secondary-button" data-action="rollback-skill" data-id="${skill.id}">回滚</button>
        <button class="secondary-button" data-action="merge-skill-demo" data-id="${skill.id}">合并入口</button>
      </div>
    </div>
  `;
}

function renderSkillSidePanel(skill, state) {
  const conflicts = detectSkillConflicts(state.skills.filter((item) => item.status === "已启用"), "当前任务");
  const relatedConflicts = conflicts.filter((item) => item.skillA === skill.id || item.skillB === skill.id);
  const recentLogs = (state.modelLogs || []).filter((log) => (log.matchedSkillIds || []).includes(skill.id)).slice(0, 6);
  return `
    <div class="panel">
      <h2>版本记录</h2>
      <div class="version-list">${(skill.changelog || []).slice(0, 8).map((item) => `<div><strong>${escapeHtml(item.summary)}</strong><span>${formatDate(item.at)}｜${escapeHtml(item.actor || "系统")}</span></div>`).join("")}</div>
    </div>
    <div class="panel">
      <h2>AI 优化建议</h2>
      <div class="panel-actions">
        <button class="secondary-button" data-action="skill-suggestion" data-id="${skill.id}">生成建议</button>
        <button class="secondary-button" data-action="test-skill" data-id="${skill.id}">回归测试</button>
        <button class="primary-button" data-action="enable-skill" data-id="${skill.id}">启用测试版本</button>
      </div>
      ${state.skillSuggestion?.targetSkillId === skill.id ? `<div class="suggestion-box">${keyValueGrid([["更新原因", state.skillSuggestion.updateReason], ["新增规则", state.skillSuggestion.proposedRules], ["预期提升", state.skillSuggestion.expectedImprovement], ["副作用", state.skillSuggestion.possibleSideEffects], ["建议", state.skillSuggestion.recommendation]])}</div>` : "<p class='muted'>可基于案例库生成优化建议，启用前需人工确认。</p>"}
      ${state.skillComparisonReport ? `<div class="suggestion-box"><h3>对比报告</h3>${keyValueGrid([["旧版本", state.skillComparisonReport.oldSkillVersion], ["新版本", state.skillComparisonReport.newSkillVersion], ["测试案例", state.skillComparisonReport.casesTested], ["提升", state.skillComparisonReport.improvements], ["回归", state.skillComparisonReport.regressions], ["建议", state.skillComparisonReport.recommendation]])}</div>` : ""}
    </div>
    <div class="panel">
      <h2>冲突提示</h2>
      ${
        relatedConflicts.length
          ? relatedConflicts.map((item) => `<article class="conflict-card"><strong>${escapeHtml(item.conflictDescription)}</strong><p>${escapeHtml(item.suggestedResolution)}</p><span>${escapeHtml(item.skillA)} ↔ ${escapeHtml(item.skillB)}</span></article>`).join("")
          : "<p class='muted'>暂无明显冲突。系统不会静默忽略冲突。</p>"
      }
    </div>
    <div class="panel">
      <h2>最近使用日志</h2>
      <div class="log-table compact">
        ${recentLogs.map((log) => `<div><strong>${escapeHtml(log.taskLabel || log.taskType)}</strong><span>${escapeHtml(log.modelName || "未知模型")}</span><span>${log.success ? "成功" : "失败"}</span><span>${formatDate(log.createdAt)}</span></div>`).join("") || "<p class='muted'>暂无调用记录。</p>"}
      </div>
    </div>
  `;
}

function renderIdeaEvaluation(evaluation) {
  return `
    <section class="panel">
      <div class="panel-title"><h2>创意评估</h2><span class="status-pill">已生成</span></div>
      <div class="score-strip">
        ${scoreCard("商业潜力", evaluation.commercialPotentialScore)}
        ${scoreCard("新鲜度", evaluation.noveltyScore)}
        ${scoreCard("执行难度", evaluation.executionDifficultyScore, true)}
      </div>
      ${keyValueGrid([
        ["一句话梗概", evaluation.logline],
        ["核心钩子", evaluation.coreHook],
        ["核心反差", evaluation.coreContrast],
        ["核心悬疑", evaluation.coreSuspense],
        ["观众情绪", evaluation.potentialAudienceNeeds],
        ["建议", evaluation.suggestions]
      ])}
    </section>
  `;
}

function renderDirectionCandidates(project) {
  if (!project.directionCandidates.length) return "";
  return `
    <section class="panel">
      <div class="panel-title">
        <h2>方向方案</h2>
        <button class="small-button" data-action="lock-direction">${icon("lock")}锁定方向</button>
      </div>
      <div class="candidate-grid">
        ${project.directionCandidates
          .map(
            (candidate) => `
          <article class="candidate-card ${project.selectedDirection?.id === candidate.id ? "selected" : ""}">
            <h3>${candidate.title}</h3>
            <p>${candidate.logline}</p>
            <div class="mini-score-row">
              <span>商业 ${candidate.commercialPotentialScore}</span>
              <span>新鲜 ${candidate.freshnessScore}</span>
              <span>情绪 ${candidate.emotionalIntensityScore}</span>
            </div>
            <strong>${candidate.recommendation}</strong>
            <button class="small-button" data-action="select-direction" data-id="${candidate.id}">选择该方向</button>
          </article>`
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderThemeCandidates(project) {
  if (!project.themeCandidates.length) return "";
  return `
    <section class="panel">
      <h2>主题与情绪方案</h2>
      <div class="candidate-grid">
        ${project.themeCandidates
          .map(
            (candidate) => `
          <article class="candidate-card ${project.lockedTheme?.id === candidate.id ? "selected" : ""}">
            <h3>${candidate.audienceNeed}<span>${candidate.score}</span></h3>
            <p>${candidate.themeStatement}</p>
            ${keyValueGrid([["情绪承诺", candidate.emotionalPromise], ["反主题力量", candidate.antiThemeForce], ["风险", candidate.risks]])}
            <button class="small-button" data-action="lock-theme" data-id="${candidate.id}">${icon("lock")}锁定主题</button>
          </article>`
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderReversalCandidates(project) {
  if (!project.mainlineReversalCandidates.length) return "";
  return `
    <section class="panel">
      <h2>主线大反差方案</h2>
      <div class="candidate-grid">
        ${project.mainlineReversalCandidates
          .map(
            (candidate) => `
          <article class="candidate-card wide ${project.lockedMainlineReversal?.id === candidate.id ? "selected" : ""}">
            <h3>${candidate.title}</h3>
            ${keyValueGrid([["观众原以为", candidate.surfaceStory], ["中后段发现", candidate.deepTruth], ["人物影响", candidate.characterImpact], ["结局影响", candidate.impactOnEnding], ["风险", candidate.risks]])}
            <div class="mini-score-row"><span>新鲜 ${candidate.freshnessScore}</span><span>合理 ${candidate.rationalityScore}</span><span>情绪 ${candidate.emotionalScore}</span></div>
            <button class="small-button" data-action="lock-reversal" data-id="${candidate.id}">${icon("lock")}锁定大反差</button>
          </article>`
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderEndingAndNodes(project) {
  if (!project.endingCandidates.length && !project.majorNodeCandidates.length) return "";
  return `
    <section class="panel">
      <h2>结局与大节点</h2>
      <div class="candidate-grid">
        ${project.endingCandidates
          .map(
            (candidate) => `
          <article class="candidate-card ${project.lockedEnding?.id === candidate.id ? "selected" : ""}">
            <h3>${candidate.title}<span>${candidate.score}</span></h3>
            <p>${candidate.finalSituation}</p>
            ${keyValueGrid([["最终选择", candidate.protagonistFinalChoice], ["情绪兑现", candidate.emotionalPayoff], ["代价", candidate.cost], ["余味", candidate.aftertaste]])}
            <button class="small-button" data-action="lock-ending" data-id="${candidate.id}">${icon("lock")}锁定结局</button>
          </article>`
          )
          .join("")}
      </div>
      ${project.majorNodeCandidates
        .map(
          (plan) => `
        <div class="node-plan ${project.lockedMajorNodes?.id === plan.id ? "selected" : ""}">
          <div class="panel-title"><h3>${plan.title}</h3><button class="small-button" data-action="lock-nodes" data-id="${plan.id}">${icon("lock")}锁定大节点</button></div>
          <div class="node-list">${plan.nodes.map((node) => `<div><strong>${node.nodeNo}. ${node.title}</strong><span>${node.suggestedEpisodeRange}</span><p>${node.keyEvent}</p></div>`).join("")}</div>
        </div>`
        )
        .join("")}
    </section>
  `;
}

function renderPreconditionLocks(project) {
  const required = [
    ["direction", "创意方向"],
    ["theme", "观众情绪与主题"],
    ["reversal", "主线大反差"],
    ["ending", "结局"],
    ["majorNodes", "关键大节点"]
  ];
  return `
    <div class="panel-title"><h2>生成前置检查</h2><span>${required.filter(([key]) => project.locks[key]).length}/${required.length} 已锁定</span></div>
    <div class="precondition-row">
      ${required.map(([key, label]) => `<span class="${project.locks[key] ? "ok" : "warn"}">${project.locks[key] ? icon("check") : icon("warn")}${label}</span>`).join("")}
    </div>
    <p class="muted">允许临时生成，但未锁定项会进入风险提示；锁定内容不会被后续生成擅自覆盖。</p>
  `;
}

function renderMacroOutline(macro) {
  return `
    <section class="panel">
      <div class="panel-title"><h2>宏观结构</h2><button class="small-button" data-action="export-outline">导出细纲</button></div>
      ${keyValueGrid([
        ["一句话梗概", macro.logline],
        ["题材", macro.genre],
        ["观众情绪需求", macro.audienceNeeds],
        ["主题句", macro.themeStatement],
        ["主线大反差", macro.mainlineReversal],
        ["结局", macro.ending],
        ["人物弧光", macro.protagonistArc]
      ])}
      <div class="three-column">
        <div>${renderMiniObject("金手指", macro.goldfingerDesign, ["rules", "limits", "costs"])}</div>
        <div>${renderMiniObject("故事发动机", macro.storyEngine, ["protagonistGoal", "centralConflict", "whyCannotStop"])}</div>
        <div>${renderMiniObject("人物核心", macro.characterCore.protagonist, ["surfaceDesire", "innerLack", "finalChoice"])}</div>
      </div>
    </section>
  `;
}

function renderMiniObject(title, object, keys) {
  return `<article class="mini-object"><h3>${title}</h3>${keys.map((key) => `<p><strong>${labelForKey(key)}</strong>${formatValue(object[key])}</p>`).join("")}</article>`;
}

function renderEpisodeOutlineCard(episode, selectedNo) {
  return `
    <article class="episode-card ${selectedNo === episode.episodeNo ? "selected" : ""} ${episode.risks?.some((risk) => risk.includes("人物变化不足")) ? "weak" : ""}" data-action="select-episode" data-no="${episode.episodeNo}">
      <button class="card-hit" data-action="select-episode" data-no="${episode.episodeNo}"></button>
      <div class="episode-head"><strong>${episode.episodeNo}</strong><h3>${episode.title}</h3><span>阶段 ${episode.stageNo}</span></div>
      <p>${episode.openingHook}</p>
      <div class="episode-fields">
        <span>爽点：${episode.coolMoment}</span>
        <span>人物：${episode.characterFunction || "不足"}</span>
        <span>悬念：${episode.cliffhanger}</span>
      </div>
      <div class="episode-actions">
        <button class="small-button" data-action="repair-episode" data-no="${episode.episodeNo}">局部修复</button>
        <button class="small-button" data-action="generate-draft" data-no="${episode.episodeNo}">成稿</button>
      </div>
    </article>
  `;
}

function renderEpisodeEditor(episode) {
  const fields = ["openingHook", "episodeGoal", "conflict", "keyEvent", "coolMoment", "characterFunction", "themeFunction", "relationshipChange", "cliffhanger"];
  return `
    <div class="panel-title"><h2>第 ${episode.episodeNo} 集人工修正</h2><button class="small-button" data-action="save-episode-edits" data-no="${episode.episodeNo}">保存修正</button></div>
    <div class="edit-field-list">
      ${fields
        .map(
          (field) => `
        <label>${labelForKey(field)}
          <textarea data-episode-field="${field}">${escapeHtml(episode[field] || "")}</textarea>
        </label>`
        )
        .join("")}
    </div>
  `;
}

function renderEpisodePicker(project, selectedNo) {
  return `
    <section class="episode-picker">
      ${project.episodeOutline
        .slice(0, 36)
        .map((episode) => `<button class="${selectedNo === episode.episodeNo ? "active" : ""}" data-action="select-episode" data-no="${episode.episodeNo}">${episode.episodeNo}</button>`)
        .join("")}
    </section>
  `;
}

function renderSceneDraft(scene) {
  return `
    <article class="scene-card">
      <div class="scene-head"><strong>场 ${scene.sceneNo}</strong><span>${scene.location}｜${scene.time}</span></div>
      <p>${scene.actionDescription}</p>
      <div class="dialogue-list">
        ${scene.dialogue.map((line) => `<div><strong>${line.character}</strong><span>${line.tone}</span><p>${line.line}</p><em>${line.subtext}</em></div>`).join("")}
      </div>
      <footer>${scene.visualNotes}｜${scene.transition}</footer>
    </article>
  `;
}

function renderDraftAudit(audit) {
  return `<div class="draft-audit"><h3>成稿审计：${audit.score}</h3>${audit.issues.map((issue) => `<p>${issue.issueType}：${issue.description}</p>`).join("") || "<p>暂无明显问题。</p>"}</div>`;
}

function renderIssueRow(issue) {
  return `
    <article class="issue-row ${issue.severity}">
      <div><strong>第 ${issue.episodeNo} 集｜${issue.issueType}</strong><p>${issue.description}</p><span>${issue.suggestion}</span></div>
      <button class="small-button" data-action="repair-episode" data-no="${issue.episodeNo}">${issue.repairAction}</button>
    </article>
  `;
}

function renderRepairItem(repair) {
  return `
    <details class="repair-item">
      <summary><strong>${repair.changeSummary}</strong><span>${formatDate(repair.createdAt)}</span></summary>
      ${keyValueGrid([["修复类型", repair.repairType], ["影响范围", repair.impactScope], ["风险", repair.risks]])}
      <div class="diff-grid"><pre>${escapeHtml(repair.before)}</pre><pre>${escapeHtml(repair.after)}</pre></div>
    </details>
  `;
}

function keyValueGrid(entries) {
  return `
    <div class="kv-grid">
      ${entries
        .map(([label, value]) => `<div><span>${label}</span><strong>${formatValue(value)}</strong></div>`)
        .join("")}
    </div>
  `;
}

function scoreCard(label, score, inverse = false) {
  const good = inverse ? score < 70 : score >= 80;
  return `<div class="score-card ${good ? "good" : "warn"}"><strong>${score}</strong><span>${label}</span></div>`;
}

function metric(label, value, desc) {
  return `<article class="metric"><strong>${value}</strong><span>${label}</span><p>${desc}</p></article>`;
}

function emptyState(title, desc) {
  return `<section class="empty-state">${icon("spark")}<h2>${title}</h2><p>${desc}</p></section>`;
}

function activeSkillSummary(state) {
  const skill = state.skills.find((item) => item.status === "已启用");
  return skill ? `${skill.name} ${skill.version}` : "未启用";
}

function filterSkills(skills, filters = {}) {
  return skills.filter((skill) => {
    const functionOk = !filters.function || filters.function === "全部" || skill.skillType === filters.function;
    const genreOk =
      !filters.genre ||
      filters.genre === "全部" ||
      skill.skillType === filters.genre ||
      (skill.genreScope || []).some((item) => filters.genre.includes(item) || item.includes(filters.genre.replace(" Skill", "")));
    const audienceOk =
      !filters.audience ||
      filters.audience === "全部" ||
      skill.skillType === filters.audience ||
      (skill.audienceNeedScope || []).some((item) => filters.audience.includes(item) || item.includes(filters.audience.replace(" Skill", "")));
    const statusOk = !filters.status || filters.status === "全部" || skill.status === filters.status;
    return functionOk && genreOk && audienceOk && statusOk;
  });
}

function getApiModeDemoRouteWarnings(config) {
  if (config?.mode !== "api") return [];
  const demoModelIds = new Set(
    (config.models || [])
      .filter((model) => model.id === "model-demo-rule-engine" || model.modelName === "DemoRuleEngine-v1")
      .map((model) => model.id)
  );
  const warnings = [];
  if (demoModelIds.has(config.globalDefaultModelId)) warnings.push("真实 API Mode 下，全局默认模型仍是 DemoRuleEngine。");
  for (const route of config.routes || []) {
    if (route.enabled && demoModelIds.has(route.primaryModelId)) {
      warnings.push(`当前为真实 API Mode，但 ${route.taskType} 任务路由仍指向 Demo 模型。`);
    }
  }
  return warnings;
}

function providerNameForModel(config, model) {
  return config.providers.find((provider) => provider.id === model.providerId)?.name || model.providerId || "未绑定 Provider";
}

function readSkillField(field) {
  return document.querySelector(`[data-skill-field="${field}"]`)?.value || "";
}

function readProviderField(field) {
  return document.querySelector(`[data-provider-field="${field}"]`)?.value || "";
}

function readModelField(field) {
  return document.querySelector(`[data-model-field="${field}"]`)?.value || "";
}

function readRouteField(field) {
  return document.querySelector(`[data-route-field="${field}"]`)?.value || "";
}

function parseLines(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCsv(value) {
  return String(value || "")
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatValue(value) {
  if (Array.isArray(value)) return value.length ? value.map((item) => (typeof item === "object" ? item.title || item.name || JSON.stringify(item) : item)).join("、") : "暂无";
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, val]) => `${labelForKey(key)}：${formatValue(val)}`)
      .join("；");
  }
  if (value === null || value === undefined || value === "") return "未填写";
  return escapeHtml(String(value));
}

function formatDate(value) {
  if (!value) return "未知时间";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function showToast(message) {
  toast = message;
  render();
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast = "";
    render();
  }, 2200);
}

function icon(name) {
  const paths = {
    layout: "M4 5h16M4 12h7M13 12h7M4 19h16",
    scan: "M6 4H4v4M18 4h2v4M6 20H4v-4M18 20h2v-4M8 12h8",
    archive: "M4 7h16v13H4z M3 4h18v3H3z M9 11h6",
    layers: "M12 3 3 8l9 5 9-5-9-5z M3 13l9 5 9-5",
    spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z",
    compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M15 9l-2 5-5 2 2-5 5-2z",
    list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
    pen: "M4 20l4-1 10-10-3-3L5 16l-1 4z M14 6l3 3",
    shield: "M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z",
    loop: "M4 12a8 8 0 0 1 13-6M17 3v4h-4M20 12a8 8 0 0 1-13 6M7 21v-4h4",
    settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M4 12h2M18 12h2M12 4v2M12 18v2",
    download: "M12 3v12M8 11l4 4 4-4M4 21h16",
    lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6z",
    unlock: "M7 11V8a5 5 0 0 1 9-3M6 11h12v10H6z",
    upload: "M12 21V9M8 13l4-4 4 4M4 21h16M4 5h16",
    check: "M5 12l4 4L19 6",
    warn: "M12 3l9 16H3l9-16z M12 9v4M12 17h.01"
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.spark}"></path></svg>`;
}
