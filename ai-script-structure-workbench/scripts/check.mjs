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
import {
  applyProviderTemplate,
  coreRouteTaskTypes,
  createDeepSeekTemplate,
  createModelDraft,
  createProviderDraft,
  createRouteDraft,
  switchCoreRoutesToModel
} from "../src/model-config.js";
import { clampMaxOutputTokens, selectModelRoute } from "../src/model-router.js";
import { callModel, shouldRetryModelError, testModelRoute } from "../src/model-adapter.js";
import { sanitizeStateForSnapshot } from "../src/redaction.js";
import { schemaValidationMessage, validateTaskOutput } from "../src/schema-validator.js";
import { extractDocxTextFromArrayBuffer, parseScriptFile } from "../src/file-parser.js";
import { hasUsefulRuntimeSettings, mergeRuntimeApiConfig, syncRuntimeSettings } from "../src/storage.js";
import { resolveRequestFormat } from "../src/request-format.js";
import { buildGeminiGenerateContentUrl, messagesToGeminiRequestBody, shouldUseGeminiNative } from "../src/provider-adapters/gemini.js";
import { buildOpenAIChatRequestBody } from "../src/provider-adapters/openai-compatible.js";

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
assert.equal(providerDraft.requestFormat, "openai_chat");
assert.ok(modelDraft.modelType.length);
assert.equal(modelDraft.supportsJsonMode, false);
assert.ok(routeDraft.taskType);

const geminiProvider = { ...providerDraft, providerType: "openai_compatible", requestFormat: "auto", baseUrl: "https://generativelanguage.googleapis.com/v1beta" };
const geminiModel = { ...modelDraft, modelName: "gemini-3.1-flash-lite-preview", displayName: "Gemini 3.1 Flash Lite", supportsJsonMode: true };
assert.equal(shouldUseGeminiNative({ provider: geminiProvider, model: geminiModel }), true);
assert.equal(shouldUseGeminiNative({ provider: { ...geminiProvider, requestFormat: "openai_chat" }, model: geminiModel }), false);
assert.equal(shouldUseGeminiNative({ provider: { ...providerDraft, requestFormat: "auto", baseUrl: "https://api.proxy.example/v1" }, model: geminiModel }), false);
assert.equal(resolveRequestFormat({ provider: { ...providerDraft, requestFormat: "gemini_native" }, model: geminiModel }), "gemini_native");
assert.equal(
  buildGeminiGenerateContentUrl("https://generativelanguage.googleapis.com/v1beta", "gemini-test", "key-123"),
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=key-123"
);
const openAiBodyWithoutJsonMode = buildOpenAIChatRequestBody({
  model: { ...modelDraft, modelName: "gemini-through-proxy", supportsJsonMode: false, supportsJsonModeExplicit: false },
  messages: [{ role: "user", content: "JSON please" }],
  options: { jsonModeRequired: true, maxOutputTokens: 128 }
});
assert.equal(Object.hasOwn(openAiBodyWithoutJsonMode, "response_format"), false);
const openAiBodyWithExplicitJsonMode = buildOpenAIChatRequestBody({
  model: { ...modelDraft, modelName: "json-model", supportsJsonMode: true, supportsJsonModeExplicit: true },
  messages: [{ role: "user", content: "JSON please" }],
  options: { jsonModeRequired: true, maxOutputTokens: 128 }
});
assert.deepEqual(openAiBodyWithExplicitJsonMode.response_format, { type: "json_object" });
const geminiBody = messagesToGeminiRequestBody(
  [
    { role: "system", content: "系统原则" },
    { role: "user", content: "请返回 JSON" }
  ],
  { jsonModeRequired: true, maxOutputTokens: 256, temperature: 0.1 }
);
assert.equal(geminiBody.systemInstruction.parts[0].text, "系统原则");
assert.equal(geminiBody.contents[0].parts[0].text, "请返回 JSON");
assert.equal(geminiBody.generationConfig.responseMimeType, "application/json");

const deepSeekTemplate = createDeepSeekTemplate();
assert.equal(deepSeekTemplate.provider.providerType, "deepseek");
assert.equal(deepSeekTemplate.provider.requestFormat, "openai_chat");
assert.ok(deepSeekTemplate.models.some((model) => model.modelName === "deepseek-chat"));
assert.ok(deepSeekTemplate.models.every((model) => model.supportsJsonMode === false));
const templatedConfig = applyProviderTemplate(state.apiConfig, "deepseek");
assert.equal(templatedConfig.providers[0].providerType, "deepseek");

const switchedConfig = switchCoreRoutesToModel(apiStateLike(state.apiConfig), "model-openai-compatible-default");
assert.equal(switchedConfig.globalDefaultModelId, "model-openai-compatible-default");
for (const taskType of coreRouteTaskTypes) {
  assert.equal(switchedConfig.routes.find((route) => route.taskType === taskType)?.primaryModelId, "model-openai-compatible-default");
}

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
assert.equal(clampMaxOutputTokens(200000, "analyzeScript"), 12000);
assert.equal(clampMaxOutputTokens(200000, "jsonRepair"), 4096);

const proxyCalls = [];
globalThis.__MODEL_CALL_PROXY__ = async (payload) => {
  proxyCalls.push(payload);
  return {
    outputText: JSON.stringify(evaluateIdea(apiState.currentProject)),
    tokenUsage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    requestFormat: payload.requestFormat,
    endpointType: "server_proxy",
    status: 200
  };
};
const apiSuccessState = structuredClone(apiState);
apiSuccessState.apiConfig = switchCoreRoutesToModel(apiSuccessState.apiConfig, "model-openai-compatible-default");
const apiSuccessResult = await callModel({
  taskType: "evaluateIdea",
  featureArea: "创作决策中心",
  inputMeta: { project: apiSuccessState.currentProject },
  state: apiSuccessState
});
assert.equal(apiSuccessResult.success, true);
assert.equal(apiSuccessResult.mode, "api");
assert.equal(apiSuccessResult.endpointType, "server_proxy");
assert.equal(apiSuccessResult.requestFormat, "openai_chat");
assert.equal(apiSuccessResult.log.serverProxy, true);
assert.equal(proxyCalls.length, 1);
assert.equal(proxyCalls[0].requestFormat, "openai_chat");
assert.equal(proxyCalls[0].providerId, "provider-openai-compatible-template");
assert.equal(proxyCalls[0].modelId, "model-openai-compatible-default");
assert.equal(Object.hasOwn(proxyCalls[0], "provider"), false);
assert.equal(Object.hasOwn(proxyCalls[0], "model"), false);
delete globalThis.__MODEL_CALL_PROXY__;

const wrappedAnalysisCalls = [];
globalThis.__MODEL_CALL_PROXY__ = async (payload) => {
  wrappedAnalysisCalls.push(payload);
  return {
    outputText:
      "```json\n" +
      JSON.stringify({
        scriptAnalysis: {
          title: "模型自带标题",
          structureFunction: {
            hook: "开局直接给出可追看的命运危机。",
            pacing: "前 5 集建立压迫和小反击，中段转向主线真相。",
            riskAssessment: ["模型返回了非标准字段，需要补齐结构档案。"]
          }
        }
      }) +
      "\n```",
    tokenUsage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
    requestFormat: payload.requestFormat,
    endpointType: "server_proxy",
    status: 200
  };
};
const scriptDraftInput = {
  ...apiSuccessState.scriptInput,
  title: "用户填写标题",
  genre: "都市 / 重生 / 复仇",
  episodeCount: 24,
  text: "毒手巫医\n第一集\n主角在危机中重生。"
};
const wrappedAnalysisResult = await callModel({
  taskType: "analyzeScript",
  featureArea: "剧本分析中心",
  inputMeta: scriptDraftInput,
  state: apiSuccessState
});
assert.equal(wrappedAnalysisResult.success, true);
assert.equal(wrappedAnalysisResult.mode, "api");
assert.equal(wrappedAnalysisCalls.length, 1);
assert.equal(wrappedAnalysisResult.parsedJson.basicInfo.title, "用户填写标题");
assert.deepEqual(wrappedAnalysisResult.parsedJson.basicInfo.genre, ["都市", "重生", "复仇"]);
assert.equal(wrappedAnalysisResult.parsedJson.basicInfo.episodeCount, 24);
assert.equal(validateTaskOutput("analyzeScript", wrappedAnalysisResult.parsedJson).ok, true);
assert.ok(wrappedAnalysisResult.warnings.some((warning) => warning.includes("scriptAnalysis")));
assert.ok(wrappedAnalysisResult.warnings.some((warning) => warning.includes("结构不完整")));
delete globalThis.__MODEL_CALL_PROXY__;

const routeProbeCalls = [];
globalThis.__MODEL_CALL_PROXY__ = async (payload) => {
  routeProbeCalls.push(payload);
  return {
    outputText: "ROUTE_OK",
    tokenUsage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    requestFormat: payload.requestFormat,
    endpointType: "server_proxy",
    status: 200,
    serverStatus: 200,
    providerStatus: 200
  };
};
const routeProbeState = structuredClone(apiState);
routeProbeState.apiConfig.routes = routeProbeState.apiConfig.routes.map((route) =>
  route.taskType === "analyzeScript" ? { ...route, maxOutputTokens: 200000, timeoutMs: 60000, retryCount: 1 } : route
);
const routeProbeResult = await testModelRoute({
  taskType: "analyzeScript",
  featureArea: "剧本分析中心",
  inputMeta: { project: routeProbeState.currentProject },
  state: routeProbeState
});
assert.equal(routeProbeResult.success, true);
assert.equal(routeProbeResult.mode, "api");
assert.equal(routeProbeCalls.length, 1);
assert.equal(routeProbeCalls[0].options.jsonModeRequired, false);
assert.equal(routeProbeCalls[0].options.maxOutputTokens, 256);
assert.ok(routeProbeResult.warnings.some((warning) => warning.includes("maxOutputTokens 200000")));
delete globalThis.__MODEL_CALL_PROXY__;

const modelResult = await callModel({
  taskType: "evaluateIdea",
  featureArea: "创作决策中心",
  inputMeta: { project: state.currentProject },
  state
});
assert.equal(modelResult.success, true);
assert.equal(modelResult.mode, "demo");
assert.equal(modelResult.requestFormat, "demo");
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
assert.equal(apiDemoResult.success, false);
assert.equal(apiDemoResult.mode, "demo");
assert.equal(apiDemoResult.requiresRouteFix, true);
assert.ok(apiDemoResult.error.includes("仍指向 Demo 模型"));
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
    retryCount: 1,
    timeoutMs: 1000
  }
];
failingApiState.apiConfig.globalDefaultModelId = "model-fail-a";
const failingProxyCalls = [];
globalThis.__MODEL_CALL_PROXY__ = async (payload) => {
  failingProxyCalls.push(payload);
  if (payload.modelId === "model-fail-a") throw new Error("Failed to fetch");
  throw new Error('Provider 请求失败：400 {"error":{"message":"Invalid JSON payload received. Unknown name \\"messages\\": Cannot find field."}}');
};
const failingResult = await callModel({
  taskType: "analyzeScript",
  featureArea: "剧本分析中心",
  inputMeta: failingApiState.scriptInput,
  state: failingApiState
});
assert.equal(failingResult.success, false);
assert.equal(failingResult.mode, "api");
assert.equal(failingResult.requestFormat, "gemini_native");
assert.equal(failingResult.usedFallback, true);
assert.ok(failingResult.error.includes("主模型第 1/2 次失败"));
assert.ok(failingResult.error.includes("备用模型第 1/2 次失败"));
assert.ok(failingResult.error.includes("第 2/2 次失败"));
assert.ok(failingResult.log);
assert.equal(failingResult.log.success, false);
assert.equal(failingResult.log.attemptErrors.length, 4);
assert.equal(failingResult.endpointType, "server_proxy");
assert.ok(failingResult.error.includes("前端请求本地 /api/model-call 失败"));
assert.ok(failingResult.error.includes("当前接口不接受 OpenAI Chat Completions 格式"));
assert.ok(failingResult.error.includes("不可重试原因"));
assert.equal(failingProxyCalls.length, 3);
assert.ok(failingProxyCalls.every((payload) => !Object.hasOwn(payload, "provider") && !Object.hasOwn(payload, "model")));
assert.ok(failingProxyCalls.every((payload) => Object.hasOwn(payload, "providerId") && Object.hasOwn(payload, "modelId")));
assert.equal(shouldRetryModelError(new Error("Failed to fetch")), true);
assert.equal(shouldRetryModelError(new Error("Provider 请求失败：429 rate limited")), true);
assert.equal(shouldRetryModelError(new Error("Provider 请求失败：503 unavailable")), true);
assert.equal(shouldRetryModelError(new Error("结构校验失败：缺少 directionCandidates")), false);
assert.equal(shouldRetryModelError(new Error("Provider 请求失败：400 Unknown name \"messages\"")), false);
delete globalThis.__MODEL_CALL_PROXY__;

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

const localApiConfig = structuredClone(state.apiConfig);
localApiConfig.providers[1].apiKey = "sk-local-browser";
const runtimeApiConfig = structuredClone(state.apiConfig);
runtimeApiConfig.mode = "api";
runtimeApiConfig.providers[1] = {
  ...runtimeApiConfig.providers[1],
  enabled: true,
  baseUrl: "https://api.example.com/v1",
  apiKey: "sk-runtime-settings"
};
runtimeApiConfig.models[1] = { ...runtimeApiConfig.models[1], enabled: true };
const mergedRuntime = mergeRuntimeApiConfig(localApiConfig, runtimeApiConfig);
assert.equal(mergedRuntime.mode, "api");
assert.equal(mergedRuntime.providers[1].apiKey, "sk-runtime-settings");
const runtimeWithoutKey = structuredClone(runtimeApiConfig);
runtimeWithoutKey.providers[1].apiKey = "";
const mergedRuntimeWithoutKey = mergeRuntimeApiConfig(localApiConfig, runtimeWithoutKey);
assert.equal(mergedRuntimeWithoutKey.providers[1].apiKey, "sk-local-browser");
assert.equal(hasUsefulRuntimeSettings(createSeedState().apiConfig), false);

const docxBuffer = createStoredZip(
  "word/document.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
      <w:p><w:r><w:t>第1集：订婚宴开局</w:t></w:r></w:p>
      <w:p><w:r><w:t>主角选择反击 &amp; 留下伏笔</w:t></w:r></w:p>
    </w:body>
  </w:document>`
);
const docxText = await extractDocxTextFromArrayBuffer(bufferToArrayBuffer(docxBuffer));
assert.ok(docxText.includes("第1集：订婚宴开局"));
assert.ok(docxText.includes("主角选择反击 & 留下伏笔"));
assert.ok(!docxText.includes("<w:t>"));
await assert.rejects(
  () => parseScriptFile({ name: "old-word.doc", text: async () => "" }),
  /另存为 \.docx/
);

const gitignore = await fs.readFile(new URL("../.gitignore", import.meta.url), "utf8");
for (const pattern of [".env", ".env.*", "config.local.json", "data/settings/*.json", "data/api-config*.json", "data/model-config*.json"]) {
  assert.ok(gitignore.includes(pattern), `.gitignore missing ${pattern}`);
}

const files = ["index.html", "server.js", "src/app.js", "src/styles.css"];
for (const file of files) {
  await fs.access(new URL(`../${file}`, import.meta.url));
}

const serverSource = await fs.readFile(new URL("../server.js", import.meta.url), "utf8");
assert.ok(serverSource.includes('url.pathname === "/api/model-call"'));
assert.ok(serverSource.includes("resolveProviderModel"));
assert.ok(serverSource.includes("providerId"));
assert.ok(!serverSource.includes("body.provider?.id"));
assert.ok(serverSource.includes('url.pathname === "/api/test-provider"'));
assert.ok(serverSource.includes("performProviderCall"));
assert.ok(serverSource.includes("endpointType: \"server_proxy\""));
assert.ok(serverSource.includes("settingsUpdatedAt"));
assert.ok(serverSource.includes("providerUpdatedAt"));
assert.ok(serverSource.includes("modelUpdatedAt"));
assert.ok(serverSource.includes("serverStatus"));
assert.ok(serverSource.includes("providerStatus"));
assert.ok(serverSource.includes("providerRawPreview"));
assert.ok(serverSource.includes("appendServerProxyLog({ ...responseBody, source: \"test-provider\""));
const modelAdapterSource = await fs.readFile(new URL("../src/model-adapter.js", import.meta.url), "utf8");
assert.ok(modelAdapterSource.includes('fetch("/api/model-call"'));
assert.ok(modelAdapterSource.includes("providerId: provider?.id"));
assert.ok(modelAdapterSource.includes("taskType: taskType || null"));
assert.ok(modelAdapterSource.includes("shouldRetryModelError"));
assert.ok(modelAdapterSource.includes("testModelRoute"));
assert.ok(modelAdapterSource.includes("modelErrorRetryBlockReason"));
assert.ok(modelAdapterSource.includes("不可重试原因"));
assert.ok(!modelAdapterSource.includes("const payload = { provider, model"));
assert.ok(!modelAdapterSource.includes("callOpenAICompatible"));
assert.ok(!modelAdapterSource.includes("callGemini"));
assert.ok(modelAdapterSource.includes("requiresRouteFix"));
assert.ok(modelAdapterSource.includes("executeApiAttemptWithRetries"));
assert.ok(modelAdapterSource.includes("jsonModeRequired: false"));
assert.ok(!modelAdapterSource.includes("function resolveClientRequestFormat"));
const requestFormatSource = await fs.readFile(new URL("../src/request-format.js", import.meta.url), "utf8");
assert.ok(requestFormatSource.includes("resolveRequestFormat"));
assert.ok(requestFormatSource.includes("generativelanguage.googleapis.com"));
const appSource = await fs.readFile(new URL("../src/app.js", import.meta.url), "utf8");
assert.ok(appSource.includes("syncRuntimeSettings"));
assert.ok(appSource.includes("配置已同步到本地服务"));
assert.ok(appSource.includes("API Mode + Demo 兜底"));
assert.ok(appSource.includes("轻量测试当前任务路由"));
assert.ok(appSource.includes("current-selected-model"));
assert.ok(appSource.includes("providerNameForModel"));
assert.ok(appSource.includes("这是 Demo Provider 测试，不代表真实 API 可用"));
assert.ok(appSource.includes("apiKeyInput && apiKeyInput !== provider.apiKey"));
assert.ok(appSource.includes('autocomplete="new-password"'));
assert.ok(appSource.indexOf("const current = readOpenInputs(store.getState());") < appSource.indexOf("busyAction = taskLabels[taskType] || taskType;"));
const promptBuilderSource = await fs.readFile(new URL("../src/prompt-builder.js", import.meta.url), "utf8");
const taskContractSource = await fs.readFile(new URL("../src/task-output-contracts.js", import.meta.url), "utf8");
assert.ok(promptBuilderSource.includes("getTaskOutputContract"));
assert.ok(taskContractSource.includes("不得包在 scriptAnalysis"));
assert.ok(modelAdapterSource.includes("normalizeParsedOutputForTask"));
assert.ok(modelAdapterSource.includes("coerceAnalyzeScriptOutput"));

console.log("check passed: V1.1 demo/API safety, editable Skill assets, model routing, redaction, and docx parsing are coherent");

function apiStateLike(apiConfig) {
  const next = structuredClone(apiConfig);
  next.providers = next.providers.map((provider) =>
    provider.id === "provider-openai-compatible-template"
      ? { ...provider, enabled: true, requestFormat: "openai_chat", baseUrl: "https://api.example.com/v1", apiKey: "test-key" }
      : provider
  );
  next.models = next.models.map((model) =>
    model.id === "model-openai-compatible-default" ? { ...model, enabled: true, providerId: "provider-openai-compatible-template" } : model
  );
  return next;
}

function createStoredZip(filePath, content) {
  const name = Buffer.from(filePath, "utf8");
  const data = Buffer.from(content, "utf8");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(0, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);

  const centralOffset = local.length + name.length + data.length;
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt32LE(0, 42);

  const centralSize = central.length + name.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);

  return Buffer.concat([local, name, data, central, name, eocd]);
}

function bufferToArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
