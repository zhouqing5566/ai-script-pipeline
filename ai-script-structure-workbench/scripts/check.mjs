import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { createSeedState } from "../src/seed-data.js";
import {
  analyzeScript,
  evaluateIdea,
  generateDirections,
  generateThemeCandidates,
  generateMainlineReversals,
  generateEndings,
  generateMajorNodes,
  generateMacroOutline,
  generateEpisodeOutline,
  generateDraft
} from "../src/generators.js";
import { auditOutline } from "../src/audit.js";
import { repairEpisode } from "../src/repair.js";
import { exportOutlineMarkdown, exportProjectJson } from "../src/export.js";
import {
  createNewSkill,
  duplicateSkill,
  matchSkillsForTask,
  setSkillStatus,
  updateSkill
} from "../src/skill-manager.js";
import { createModelDraft, createProviderDraft, createRouteDraft } from "../src/model-config.js";
import { selectModelRoute } from "../src/model-router.js";
import { callModel } from "../src/model-adapter.js";
import { sanitizeStateForSnapshot } from "../src/redaction.js";
import { schemaValidationMessage, validateTaskOutput } from "../src/schema-validator.js";

const state = createSeedState();
const analysis = analyzeScript(state.scriptInput);

assert.equal(analysis.title, state.scriptInput.title);
assert.ok(analysis.hookAnalysis.firstSceneFunction);
assert.ok(analysis.audienceNeedAnalysis.primaryNeeds.length >= 1);
assert.ok(analysis.themeAnalysis.themeStatement);
assert.ok(analysis.characterAnalysis.protagonist.name);
assert.ok(analysis.goldfingerAnalysis.rules.length >= 1);
assert.ok(analysis.obstacleAnalysis.whyCannotBeSolvedAtOnce);
assert.ok(analysis.mainlineStructure.stageStructure.length === 5);
assert.ok(analysis.mainlineReversalAnalysis.foreshadowingBeforeReveal.length >= 1);
assert.ok(analysis.endingAnalysis.promisedEmotionReturned);
assert.ok(analysis.episodeFunctionAnalysis.length >= 5);
assert.ok(analysis.reusablePatterns.length >= 2);

state.currentProject.ideaEvaluation = evaluateIdea(state.currentProject);
state.currentProject.directionCandidates = generateDirections(state.currentProject);
assert.equal(state.currentProject.directionCandidates.length, 5);
state.currentProject.selectedDirection = state.currentProject.directionCandidates[2];
state.currentProject.themeCandidates = generateThemeCandidates(state.currentProject);
state.currentProject.lockedTheme = state.currentProject.themeCandidates[0];
state.currentProject.mainlineReversalCandidates = generateMainlineReversals(state.currentProject);
assert.equal(state.currentProject.mainlineReversalCandidates.length, 3);
state.currentProject.lockedMainlineReversal = state.currentProject.mainlineReversalCandidates[0];
state.currentProject.endingCandidates = generateEndings(state.currentProject);
state.currentProject.lockedEnding = state.currentProject.endingCandidates[0];
state.currentProject.majorNodeCandidates = generateMajorNodes(state.currentProject);
state.currentProject.lockedMajorNodes = state.currentProject.majorNodeCandidates[0];
state.currentProject.macroOutline = generateMacroOutline(state.currentProject);
state.currentProject.stageOutline = state.currentProject.macroOutline.stageOutline;
state.currentProject.episodeOutline = generateEpisodeOutline(state.currentProject);

assert.equal(state.currentProject.stageOutline.length, 5);
assert.equal(state.currentProject.episodeOutline.length, state.currentProject.creativeConstraints.episodeCount);
assert.ok(state.currentProject.episodeOutline.every((episode) => episode.openingHook && episode.cliffhanger));
assert.ok(state.currentProject.episodeOutline.some((episode) => episode.risks.join("").includes("人物变化不足")));

state.currentProject.auditReport = auditOutline(state.currentProject);
assert.ok(state.currentProject.auditReport.episodeAudit.episodeIssues.some((issue) => issue.description === "该集事件成立，但人物变化不足。"));

const weakNo = state.currentProject.auditReport.episodeAudit.episodeIssues[0].episodeNo;
const repaired = repairEpisode(state.currentProject, weakNo);
assert.ok(repaired.repair.after.includes("人物") || repaired.repair.after.includes("选择"));

const draft = generateDraft(repaired.project, 1);
assert.ok(draft.sceneList.length >= 2);

const markdown = exportOutlineMarkdown(repaired.project);
assert.ok(markdown.includes("人物功能"));
assert.ok(markdown.includes("主题功能"));
assert.ok(markdown.includes("结尾悬念"));
assert.ok(!markdown.includes("themeStatement"));
assert.ok(!markdown.includes("characterFunction：未填写"));

const requiredSkillFields = [
  "genreScope",
  "audienceNeedScope",
  "taskScope",
  "priority",
  "positiveExamples",
  "negativeExamples",
  "promptAdditions",
  "evaluationCriteria",
  "riskWarnings",
  "modelPreference"
];
for (const field of requiredSkillFields) {
  assert.ok(Object.hasOwn(state.skills[0], field), `missing skill field: ${field}`);
}

let skills = [createNewSkill({ name: "测试 Skill", taskScope: ["generateEpisodeOutline"] }), ...state.skills];
const testSkillId = skills[0].id;
skills = updateSkill(skills, testSkillId, { rules: ["编辑后的规则"], genreScope: ["都市"], audienceNeedScope: ["尊严修复"] });
assert.equal(skills[0].rules[0], "编辑后的规则");
assert.ok(skills[0].changelog.length >= 2);
skills = duplicateSkill(skills, testSkillId);
assert.ok(skills[0].name.includes("副本"));
skills = setSkillStatus(skills, testSkillId, "已停用");
assert.equal(skills.find((skill) => skill.id === testSkillId).status, "已停用");

const matched = matchSkillsForTask({
  taskType: "generateEpisodeOutline",
  featureArea: "细纲生产中心",
  project: repaired.project,
  state
});
assert.ok(matched.matchedSkillIds.includes("skill-outline-v1"));
assert.ok(matched.matchedSkillIds.includes("skill-genre-rebirth-revenge-v1"));
assert.ok(matched.matchedSkillIds.includes("skill-format-short-drama-v1"));
assert.ok(matched.matchedSkillIds.includes("skill-need-fairness-v1"));
assert.ok(matched.matchedSkillIds.includes("skill-global-structure-v1"));

assert.ok(state.apiConfig.providers[0].id);
assert.ok(state.apiConfig.models[0].id);
assert.ok(state.apiConfig.routes[0].id);
const providerDraft = createProviderDraft();
const modelDraft = createModelDraft(providerDraft.id);
const routeDraft = createRouteDraft(modelDraft.id);
assert.ok(providerDraft.providerType);
assert.ok(modelDraft.modelType.length);
assert.ok(routeDraft.taskType);

const demoSelection = selectModelRoute({
  state,
  project: state.currentProject,
  taskType: "analyzeScript",
  featureArea: "剧本分析中心",
  matchedSkills: matched.matchedSkills
});
assert.equal(demoSelection.mode, "demo");

const apiState = structuredClone(state);
apiState.apiConfig.mode = "api";
apiState.apiConfig.providers = apiState.apiConfig.providers.map((provider) =>
  provider.id === "provider-openai-compatible-template"
    ? { ...provider, enabled: true, baseUrl: "https://api.example.com/v1", apiKey: "test-key" }
    : provider
);
apiState.apiConfig.models = apiState.apiConfig.models.map((model) =>
  model.id === "model-openai-compatible-default" ? { ...model, enabled: true, providerId: "provider-openai-compatible-template" } : model
);
apiState.apiConfig.routes = apiState.apiConfig.routes.map((route) =>
  route.taskType === "analyzeScript" ? { ...route, primaryModelId: "model-openai-compatible-default" } : route
);
const apiSelection = selectModelRoute({
  state: apiState,
  project: apiState.currentProject,
  taskType: "analyzeScript",
  featureArea: "剧本分析中心",
  matchedSkills: []
});
assert.equal(apiSelection.mode, "api");
assert.equal(apiSelection.model.id, "model-openai-compatible-default");

const modelResult = await callModel({
  taskType: "evaluateIdea",
  featureArea: "创作决策中心",
  inputMeta: { project: state.currentProject },
  state
});
assert.equal(modelResult.success, true);
assert.equal(modelResult.mode, "demo");
assert.ok(modelResult.providerId);
assert.ok(modelResult.modelId);
assert.ok(Array.isArray(modelResult.matchedSkillIds));
assert.equal(modelResult.usedFallback, false);
assert.equal(modelResult.error, null);
assert.ok(modelResult.latencyMs >= 0);

const apiDemoState = structuredClone(state);
apiDemoState.apiConfig.mode = "api";
apiDemoState.apiConfig.globalDefaultModelId = "model-demo-rule-engine";
const apiDemoResult = await callModel({
  taskType: "evaluateIdea",
  featureArea: "创作决策中心",
  inputMeta: { project: apiDemoState.currentProject },
  state: apiDemoState
});
assert.equal(apiDemoResult.success, true);
assert.equal(apiDemoResult.mode, "demo");
assert.ok(apiDemoResult.warnings.some((warning) => warning.includes("真实 API Mode")));
assert.ok(apiDemoResult.log.warnings.some((warning) => warning.includes("Demo 模型")));

const failingApiState = structuredClone(apiState);
failingApiState.apiConfig.providers = [
  { id: "provider-fail-a", name: "Unsupported A", providerType: "anthropic", enabled: true, timeoutMs: 1000 },
  { id: "provider-fail-b", name: "Unsupported B", providerType: "gemini", enabled: true, timeoutMs: 1000 }
];
failingApiState.apiConfig.models = [
  { id: "model-fail-a", providerId: "provider-fail-a", displayName: "Fail A", modelName: "fail-a", enabled: true, modelType: ["text"], supportsJsonMode: true, maxOutputTokens: 1000 },
  { id: "model-fail-b", providerId: "provider-fail-b", displayName: "Fail B", modelName: "fail-b", enabled: true, modelType: ["text"], supportsJsonMode: true, maxOutputTokens: 1000 }
];
failingApiState.apiConfig.routes = [
  {
    id: "route-failing",
    featureArea: "剧本分析中心",
    taskType: "analyzeScript",
    primaryModelId: "model-fail-a",
    fallbackModelIds: ["model-fail-b"],
    requiredCapabilities: ["json"],
    maxOutputTokens: 1000,
    temperature: 0,
    topP: 1,
    jsonModeRequired: true,
    allowFallback: true,
    enabled: true,
    timeoutMs: 1000
  }
];
failingApiState.apiConfig.globalDefaultModelId = "model-fail-a";
const failingResult = await callModel({
  taskType: "analyzeScript",
  featureArea: "剧本分析中心",
  inputMeta: failingApiState.scriptInput,
  state: failingApiState
});
assert.equal(failingResult.success, false);
assert.equal(failingResult.mode, "api");
assert.equal(failingResult.usedFallback, true);
assert.ok(failingResult.error.includes("主模型失败"));
assert.ok(failingResult.error.includes("备用模型失败"));
assert.ok(failingResult.log);
assert.equal(failingResult.log.success, false);
assert.ok(failingResult.log.attemptErrors.length >= 2);

const invalidShape = validateTaskOutput("generateDirections", { bad: true });
assert.equal(invalidShape.ok, false);
assert.ok(schemaValidationMessage("generateDirections", invalidShape.issues).includes("结构校验失败"));

const secretState = structuredClone(state);
secretState.apiConfig.providers[1].apiKey = "sk-real-secret";
const exportedProject = exportProjectJson(secretState);
assert.ok(!exportedProject.includes("sk-real-secret"));
assert.ok(exportedProject.includes("[已脱敏]"));
const snapshot = JSON.stringify(sanitizeStateForSnapshot(secretState));
assert.ok(!snapshot.includes("sk-real-secret"));
assert.ok(snapshot.includes("[已脱敏]"));

const gitignore = await fs.readFile(new URL("../.gitignore", import.meta.url), "utf8");
for (const pattern of [".env", ".env.*", "config.local.json", "data/settings/*.json", "data/api-config*.json", "data/model-config*.json"]) {
  assert.ok(gitignore.includes(pattern), `.gitignore missing ${pattern}`);
}

const files = ["index.html", "server.js", "src/app.js", "src/styles.css"];
for (const file of files) {
  await fs.access(new URL(`../${file}`, import.meta.url));
}

console.log("check passed: V1.1 demo/API safety, editable Skill assets, model routing, and redaction are coherent");
