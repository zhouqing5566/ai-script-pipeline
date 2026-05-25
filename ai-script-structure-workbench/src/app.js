import { createStore } from "./state.js";
import { runModelTask } from "./model-adapter.js";
import { repairEpisode } from "./repair.js";
import { auditDraft } from "./audit.js";
import { resetLocalState, writeExport } from "./storage.js";
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

root.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action], [data-view]");
  if (!target || busyAction) return;
  if (target.dataset.view) {
    const next = readOpenInputs(store.getState());
    next.view = target.dataset.view;
    store.setState(next, `切换到${target.textContent.trim()}`, { version: false });
    return;
  }
  void handleAction(target);
});

root.addEventListener("change", (event) => {
  const fileInput = event.target.closest("#script-file");
  if (!fileInput?.files?.length) return;
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    const next = readOpenInputs(store.getState());
    next.scriptInput.text = String(reader.result || "");
    next.scriptInput.title = next.scriptInput.title || file.name.replace(/\.[^.]+$/, "");
    next.scriptInput.fileName = file.name;
    store.setState(next, "读取上传剧本文本", { targetType: "script", action: "edit" });
  };
  reader.readAsText(file);
});

async function handleAction(target) {
  const action = target.dataset.action;
  const id = target.dataset.id;
  const no = Number(target.dataset.no);

  try {
    switch (action) {
      case "reset":
        store.setState(resetLocalState(), "重置 Demo 数据", { version: false });
        showToast("已重置为初始 Demo 数据");
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
    showToast(error.message || "操作失败");
  }
}

async function executeTask(taskType, inputFactory, applyOutput, summary, options = {}) {
  busyAction = taskLabels[taskType] || taskType;
  render();
  const current = readOpenInputs(store.getState());
  const { output, log } = await runModelTask(taskType, inputFactory(current), current);
  applyOutput(current, output, log);
  busyAction = null;
  store.setState(current, summary, options);
  showToast(summary);
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
      status: "待审核",
      summary: analysis.basicInfo.coreAppeal,
      analysis
    };
    state.cases = [item, ...state.cases.filter((caseItem) => caseItem.id !== item.id)];
    return state;
  }, "保存分析结果到案例库", { targetType: "case", targetId: analysis.id, action: "generate" });
  showToast("已加入案例库");
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
          <strong>Demo Mode</strong>
          <span>规则引擎演示，不冒充真实 API</span>
        </div>
      </div>
    </aside>
  `;
}

function renderTopbar(state) {
  const project = state.currentProject;
  return `
    <header class="topbar">
      <div>
        <input id="project-title" class="project-title" value="${escapeAttr(project.title)}" aria-label="项目名" />
        <div class="top-meta">
          <span>${escapeHtml(project.status)}</span>
          <span>${escapeHtml(state.saveStatus)}</span>
          <span>模型：DemoRuleEngine-v1</span>
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
        <label class="file-button">${icon("upload")}上传 txt / md / docx / pdf<input id="script-file" type="file" accept=".txt,.md,.docx,.pdf" /></label>
        <span>当前 V1 对 docx/pdf 做文本读取演示，生产环境应接解析器。</span>
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
  return `
    <section class="page-head compact">
      <div>
        <h1>Skill 进化中心</h1>
        <p>管理分析、生成、审计和修复规则。AI 只能提出建议，人类确认后启用。</p>
      </div>
    </section>
    <section class="skill-layout">
      <div class="skill-list">
        ${state.skills
          .map(
            (skill) => `
          <button class="skill-row ${selected?.id === skill.id ? "active" : ""}" data-action="select-skill" data-id="${skill.id}">
            <strong>${skill.name}</strong>
            <span>${skill.type}｜${skill.version}｜${skill.status}</span>
          </button>`
          )
          .join("")}
      </div>
      <div class="panel">
        ${selected ? renderSkillDetail(selected, state) : emptyState("暂无 Skill", "创建或导入规则后可在这里管理。")}
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
  return `
    <section class="page-head compact">
      <div>
        <h1>系统设置</h1>
        <p>查看 Demo 模式、模型调用日志、导出路径和本地数据状态。</p>
      </div>
      <button class="danger-button" data-action="reset">重置 Demo 数据</button>
    </section>
    <section class="two-column">
      <div class="panel">
        <h2>模型状态</h2>
        ${keyValueGrid([
          ["运行模式", "Demo Mode"],
          ["说明", "规则引擎演示，不静默冒充真实 API"],
          ["本地服务", "Node server.js"],
          ["调用记录", "data/logs/model-calls.jsonl"]
        ])}
      </div>
      <div class="panel">
        <h2>最近导出</h2>
        ${
          state.lastExport
            ? keyValueGrid([
                ["文件名", state.lastExport.fileName],
                ["类型", state.lastExport.type],
                ["路径", state.lastExport.path || "未落盘"],
                ["时间", formatDate(state.lastExport.createdAt)]
              ])
            : "<p class='muted'>暂无导出。</p>"
        }
      </div>
    </section>
    <section class="panel">
      <h2>模型调用日志</h2>
      <div class="log-table">
        ${state.modelLogs
          .map((log) => `<div><strong>${log.taskLabel}</strong><span>${log.modelName}</span><span>${log.latencyMs} ms</span><span>${formatDate(log.createdAt)}</span></div>`)
          .join("") || "<p class='muted'>暂无调用记录。</p>"}
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
  return `
    <div class="panel-title">
      <h2>${skill.name}</h2>
      <span class="status-pill">${skill.status}</span>
    </div>
    ${keyValueGrid([
      ["类型", skill.type],
      ["版本", skill.version],
      ["更新时间", formatDate(skill.updatedAt)],
      ["更新原因", skill.updateReason],
      ["预期提升", skill.expectedImprovement],
      ["可回滚", skill.rollbackTarget || "暂无回滚目标"]
    ])}
    <h3>当前规则</h3>
    <ul class="rule-list">${skill.rules.map((rule) => `<li>${rule}</li>`).join("")}</ul>
    <div class="panel-actions">
      <button class="secondary-button" data-action="skill-suggestion" data-id="${skill.id}">AI 生成优化建议</button>
      <button class="secondary-button" data-action="test-skill" data-id="${skill.id}">选择评估集测试</button>
      <button class="primary-button" data-action="enable-skill" data-id="${skill.id}">启用新版本</button>
    </div>
    ${state.skillSuggestion?.targetSkillId === skill.id ? `<div class="suggestion-box"><h3>优化建议</h3>${keyValueGrid([["更新原因", state.skillSuggestion.updateReason], ["新增规则", state.skillSuggestion.proposedRules], ["预期提升", state.skillSuggestion.expectedImprovement], ["副作用", state.skillSuggestion.possibleSideEffects], ["建议", state.skillSuggestion.recommendation]])}</div>` : ""}
    ${state.skillComparisonReport ? `<div class="suggestion-box"><h3>对比报告</h3>${keyValueGrid([["旧版本", state.skillComparisonReport.oldSkillVersion], ["新版本", state.skillComparisonReport.newSkillVersion], ["测试案例", state.skillComparisonReport.casesTested], ["提升", state.skillComparisonReport.improvements], ["回归", state.skillComparisonReport.regressions], ["建议", state.skillComparisonReport.recommendation]])}</div>` : ""}
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
