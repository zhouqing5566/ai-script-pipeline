import {
  analyzeScript,
  evaluateIdea,
  generateDirections,
  generateThemeCandidates,
  generateMainlineReversals,
  generateEndings,
  generateMajorNodes,
  generateMacroOutline,
  generateStageOutline,
  generateEpisodeOutline,
  generateDraft,
  generateSkillSuggestion
} from "./generators.js";
import { auditOutline, auditDraft } from "./audit.js";
import { taskLabels } from "./schemas.js";
import { appendModelLog } from "./storage.js";

const demoModelName = "DemoRuleEngine-v1";

export async function runModelTask(taskType, input, state) {
  const startedAt = performance.now();
  let output;
  let errorMessage = null;
  try {
    output = dispatchTask(taskType, input, state);
  } catch (error) {
    errorMessage = error.message;
    output = null;
  }
  const latencyMs = Math.round(performance.now() - startedAt);
  const log = {
    id: `call-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    taskType,
    taskLabel: taskLabels[taskType] || taskType,
    modelName: demoModelName,
    skillVersion: activeSkillVersion(taskType, state),
    inputSummary: summarizeInput(input),
    outputSummary: output ? summarizeInput(output) : "无输出",
    success: !errorMessage,
    errorMessage,
    latencyMs,
    createdAt: new Date().toISOString()
  };
  await appendModelLog(log);
  if (errorMessage) throw new Error(errorMessage);
  return { output, log };
}

function dispatchTask(taskType, input, state) {
  const project = input?.project || state.currentProject;
  switch (taskType) {
    case "analyzeScript":
      return analyzeScript(input);
    case "evaluateIdea":
      return evaluateIdea(project);
    case "generateDirections":
      return generateDirections(project);
    case "generateThemeCandidates":
      return generateThemeCandidates(project);
    case "generateMainlineReversals":
      return generateMainlineReversals(project);
    case "generateEndingCandidates":
      return generateEndings(project);
    case "generateMajorNodes":
      return generateMajorNodes(project);
    case "generateMacroOutline":
      return generateMacroOutline(project);
    case "generateStageOutline":
      return generateStageOutline(project);
    case "generateEpisodeOutline":
      return generateEpisodeOutline(project);
    case "auditOutline":
      return auditOutline(project);
    case "generateDraft":
      return generateDraft(project, input.episodeNo);
    case "auditDraft":
      return auditDraft(input.draft);
    case "generateSkillSuggestion":
      return generateSkillSuggestion(input.skill, state.cases);
    case "testSkillVersion":
      return {
        oldSkillVersion: input.skill.version,
        newSkillVersion: bumpVersion(input.skill.version),
        evaluationSetId: "默认高质量案例集",
        casesTested: Math.max(1, state.cases.length),
        improvements: ["弱集人物功能识别更稳定", "分集信息增量提示更具体"],
        regressions: ["输出长度略增，需要主编筛选"],
        neutralChanges: ["题材分类无明显变化"],
        scoreOld: 78,
        scoreNew: 86,
        recommendation: "启用",
        notes: "Demo 回归结果用于展示流程，真实启用前应接入模型评估。"
      };
    default:
      throw new Error(`暂不支持的任务：${taskType}`);
  }
}

function activeSkillVersion(taskType, state) {
  const skill = state.skills.find((item) => {
    if (taskType.includes("Outline") || taskType.includes("Draft")) return item.type.includes("细纲");
    return item.type.includes("分析");
  });
  return skill ? `${skill.name} ${skill.version}` : "未绑定";
}

function summarizeInput(input) {
  const text = JSON.stringify(input ?? "");
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

function bumpVersion(version = "1.0.0") {
  const parts = version.split(".").map((item) => Number(item) || 0);
  parts[1] += 1;
  parts[2] = 0;
  return parts.join(".");
}
