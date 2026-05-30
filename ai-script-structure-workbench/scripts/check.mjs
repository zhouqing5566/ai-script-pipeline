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
  defaultTimeoutForTask,
  switchCoreRoutesToModel
} from "../src/model-config.js";
import { clampMaxOutputTokens, selectModelRoute } from "../src/model-router.js";
import { callModel, shouldRetryModelError, testModelRoute } from "../src/model-adapter.js";
import { sanitizeStateForSnapshot } from "../src/redaction.js";
import { schemaValidationMessage, validateTaskOutput } from "../src/schema-validator.js";
import { extractDocxTextFromArrayBuffer, parseScriptFile } from "../src/file-parser.js";
import { hasUsefulRuntimeSettings, mergeRuntimeApiConfig, syncRuntimeSettings } from "../src/storage.js";
import { resolveRequestFormat } from "../src/request-format.js";
import { detectScriptCoverage } from "../src/script-coverage.js";
import { splitScriptIntoEpisodes } from "../src/script-splitter.js";
import {
  aggregateScriptAnalysis,
  applyLongScriptGateFlags,
  analyzeEpisodeChunk,
  createLongScriptInputSignature,
  prepareLongScriptChunks,
  sameLongScriptInputSignature,
  shouldUseLongScriptAnalysis
} from "../src/long-script-analysis.js";
import { normalizeRelationshipEdge } from "../src/analysis-normalizers.js";
import {
  applyEvidenceValidationToAnalysis,
  normalizeBeatEntry,
  normalizeEvidenceEntry,
  validateEvidenceSourceText
} from "../src/evidence-validator.js";
import { buildGeminiGenerateContentUrl, messagesToGeminiRequestBody, shouldUseGeminiNative } from "../src/provider-adapters/gemini.js";
import { buildOpenAIChatRequestBody } from "../src/provider-adapters/openai-compatible.js";
import { labelForKey } from "../src/schemas.js";
import { extractJsonCandidate, extractJsonCandidates, extractTaskJsonCandidate } from "../src/json-extractor.js";
import { evaluateEpisodeChunkCompactShape, scoreEpisodeChunkCandidate } from "../src/episode-chunk-shape.js";
import { classifyProviderError, diagnoseProviderProtocol, suggestProviderFix } from "../src/provider-diagnostics.js";

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
assert.ok(analysis.coverage);
assert.ok(analysis.evidenceLedger);
assert.ok(analysis.episodeBeatLedger.length >= 1);
for (const section of [
  "hookAnalysis",
  "audienceNeedAnalysis",
  "themeAnalysis",
  "characterAnalysis",
  "goldfingerAnalysis",
  "obstacleAnalysis",
  "mainlineStructure",
  "mainlineReversalAnalysis",
  "endingAnalysis"
]) {
  assert.ok(analysis[section].inferenceLevel, `${section} missing inferenceLevel`);
  assert.notEqual(analysis[section].confidence, undefined, `${section} missing confidence`);
  assert.ok(
    analysis[section].needsReview === true || (analysis[section].evidenceIds?.length || analysis[section].evidenceBeatIds?.length),
    `${section} needs evidence or review flag`
  );
}
assert.ok(analysis.reusablePatterns.every((pattern) => pattern.structureSteps?.length && pattern.variableSlots && pattern.reusePrompt));
assert.ok(analysis.episodeBeatLedger.every((beat) => state.scriptInput.text.includes(beat.sourceText) || state.scriptInput.text.includes(beat.sourceText.split("\n")[0])));
assert.equal(labelForKey("openingSummary"), "开头概述");
assert.equal(labelForKey("hookTypes"), "钩子类型");
assert.equal(labelForKey("firstSceneFunction"), "首场功能");
assert.equal(labelForKey("viewerQuestion"), "观众追问");
assert.equal(labelForKey("mainlineStrengthScore"), "主线强度");
assert.equal(labelForKey("reversalStrengthScore"), "大反差强度");
assert.equal(labelForKey("endingStrengthScore"), "结局强度");
assert.equal(labelForKey("unknownFutureField"), "补充字段");

const fragmentText = "毒手巫医\n\n第一集\n\n△火车上林清突然流血倒地。\n医生：已经没救了！\n孙大为：不是脑溢血，是被人害的。\n△孙大为拿出银针，金蚕飞出。";
const fragmentCoverage = detectScriptCoverage(fragmentText, 50);
assert.equal(fragmentCoverage.canAnalyzeFullMainline, false);
assert.equal(fragmentCoverage.canAnalyzeEnding, false);
assert.equal(fragmentCoverage.allowedCaseScope, "opening_case");
assert.ok(fragmentCoverage.warnings.some((warning) => warning.includes("用户填写 50 集")));
const fragmentAnalysis = analyzeScript({ title: "毒手巫医", genre: "都市 / 高手下山", episodeCount: 50, text: fragmentText });
assert.equal(fragmentAnalysis.coverage.canAnalyzeFullMainline, false);
assert.equal(fragmentAnalysis.endingAnalysis.inferenceLevel === "原文明确", false);
assert.equal(fragmentAnalysis.mainlineStructure.inferenceLevel === "原文明确", false);
assert.equal(fragmentAnalysis.caseScope, "opening_case");
assert.ok(fragmentAnalysis.episodeFunctionAnalysis.length < 50);
assert.ok(fragmentAnalysis.evidenceLedger.hookEvidence.length >= 1);
assert.ok(fragmentAnalysis.episodeBeatLedger.length >= 1);
assert.ok(fragmentAnalysis.reusablePatterns.every((pattern) => pattern.structureSteps?.length && pattern.variableSlots && pattern.reusePrompt));
assert.equal(fragmentAnalysis.caseScope === "full_script", false);
assert.ok(fragmentAnalysis.reusablePatterns.every((pattern) => pattern.inferenceLevel !== "原文明确" || pattern.sourceEvidenceIds.length || pattern.sourceBeatIds.length));
assert.ok(fragmentAnalysis.episodeBeatLedger.every((beat) => fragmentText.includes(beat.sourceText) || fragmentText.includes(beat.sourceText.split("\n")[0])));
assert.equal(normalizeRelationshipEdge({}), null);
const normalizedEdge = normalizeRelationshipEdge({ source: "孙大为", relationshipChange: "救人后被关注" });
assert.equal(normalizedEdge.from, "孙大为");
assert.equal(normalizedEdge.to, "关系对象缺失，需复核");
assert.equal(`${normalizedEdge.from} → ${normalizedEdge.to}`.includes("undefined"), false);

const eightEpisodeText = Array.from({ length: 8 }, (_, index) => `第${index + 1}集\n角色${index}：发生局部冲突。`).join("\n");
const eightCoverage = detectScriptCoverage(eightEpisodeText, null);
assert.equal(eightCoverage.inputType, "partial_script");
assert.equal(eightCoverage.canAnalyzeFullMainline, false);
assert.equal(eightCoverage.requiresManualFullScriptConfirmation, true);
const tenCoverage = detectScriptCoverage(eightEpisodeText, 10);
assert.equal(tenCoverage.inputType, "full_script");
assert.ok(tenCoverage.estimatedCoverageRatio >= 0.78);
const endingCoverage = detectScriptCoverage("第一集\n开局\n第二集\n升级\n第三集\n大结局，全剧终", null);
assert.equal(endingCoverage.inputType, "full_script");
assert.equal(endingCoverage.canAnalyzeEnding, true);
const markerText = [
  "第一集\n开局",
  "第1集\n升级",
  "第 2 集\n追击",
  "EP01\n英文标记",
  "Episode 2\n英文完整标记",
  "第01话\n话本标记",
  "一、公共空间突发危机"
].join("\n");
const markerSplit = splitScriptIntoEpisodes(markerText);
assert.ok(markerSplit.episodes.some((episode) => episode.title.includes("第一集")));
assert.ok(markerSplit.episodes.some((episode) => episode.title.includes("第1集")));
assert.ok(markerSplit.episodes.some((episode) => episode.title.includes("第 2 集")));
assert.ok(markerSplit.episodes.some((episode) => episode.title.includes("EP01")));
assert.ok(markerSplit.episodes.some((episode) => episode.title.includes("Episode 2")));
assert.ok(markerSplit.episodes.some((episode) => episode.title.includes("第01话")));
assert.ok(markerSplit.episodes.some((episode) => episode.detectedBy === "heading"));
const fiftyEpisodeText = Array.from({ length: 50 }, (_, index) => `第${index + 1}集\n主角在第${index + 1}集遭遇危机并留下悬念。`).join("\n");
const fiftyCoverage = detectScriptCoverage(fiftyEpisodeText, 50, { userConfirmedFullScript: true });
assert.equal(fiftyCoverage.inputType, "full_script");
assert.equal(fiftyCoverage.detectedEpisodeCount, 50);
assert.ok(fiftyCoverage.completenessSource.includes("系统检测"));
assert.equal(shouldUseLongScriptAnalysis({ title: "五十集长剧", episodeCount: 50, text: fiftyEpisodeText, userConfirmedFullScript: true }, fiftyCoverage), true);
const declaredButShortText = "第一集\n主角在火车上救人，并留下蛊师追杀悬念。";
const declaredShortCoverage = detectScriptCoverage(declaredButShortText, 50, { userConfirmedFullScript: true });
assert.equal(shouldUseLongScriptAnalysis({ title: "声明五十集", episodeCount: 50, text: declaredButShortText, userConfirmedFullScript: true }, declaredShortCoverage), true);
const declaredShortSplit = prepareLongScriptChunks({ title: "声明五十集", episodeCount: 50, text: declaredButShortText, userConfirmedFullScript: true }, declaredShortCoverage);
assert.equal(declaredShortSplit.expectedChunkCount, 50);
assert.equal(declaredShortSplit.detectedChunkCount, 1);
assert.equal(declaredShortSplit.missingChunks.length, 49);
assert.ok(declaredShortSplit.warnings.some((warning) => warning.includes("仅切出") || warning.includes("系统仅切出")));
const episodeChunk = analyzeEpisodeChunk({
  projectTitle: "五十集长剧",
  genre: "都市",
  episodeNo: 1,
  episodeTitle: "第一集",
  episodeText: "第一集\n△火车危机爆发。\n主角：我来救人。\n医生：这不可能！"
});
assert.equal(episodeChunk.episodeNo, 1);
assert.ok(episodeChunk.episodeBeatLedger.length >= 1);
assert.ok(episodeChunk.evidenceLedger);
assert.ok(episodeChunk.episodeFunctionAnalysis.evidenceBeatIds?.length >= 1 || episodeChunk.episodeFunctionAnalysis.needsReview === true);
const aggregatedLong = aggregateScriptAnalysis({
  originalInput: { title: "五十集长剧", genre: "都市", episodeCount: 50, text: fiftyEpisodeText, userConfirmedFullScript: true },
  coverage: fiftyCoverage,
  episodeChunkAnalyses: [episodeChunk],
  failedChunks: [{ episodeNo: 2, title: "第二集", error: "测试失败" }]
});
assert.equal(aggregatedLong.sourceMeta.chunkedAnalysis, true);
assert.equal(aggregatedLong.sourceMeta.failedChunks.length, 1);
assert.equal(aggregatedLong.sourceMeta.needsReview, true);
assert.equal(aggregatedLong.sourceMeta.usableForSkillLearning, false);
assert.equal(aggregatedLong.sourceMeta.localAggregateFallback, true);
const missingAggregate = aggregateScriptAnalysis({
  originalInput: { title: "声明五十集", genre: "都市", episodeCount: 50, text: declaredButShortText, userConfirmedFullScript: true },
  coverage: declaredShortCoverage,
  episodeChunkAnalyses: [episodeChunk],
  failedChunks: [],
  missingChunks: declaredShortSplit.missingChunks,
  expectedChunkCount: declaredShortSplit.expectedChunkCount,
  detectedChunkCount: declaredShortSplit.detectedChunkCount
});
assert.equal(missingAggregate.sourceMeta.missingChunks.length, 49);
assert.equal(missingAggregate.sourceMeta.needsReview, true);
assert.equal(missingAggregate.sourceMeta.usableForSkillLearning, false);
assert.equal(missingAggregate.sourceMeta.usableForFullScriptCase, false);
assert.equal(missingAggregate.sourceMeta.completeAggregation, false);
const successfulAggregate = aggregateScriptAnalysis({
  originalInput: {
    title: "短完整剧",
    genre: "都市",
    episodeCount: 5,
    text: Array.from({ length: 5 }, (_, index) => `第${index + 1}集\n△主角第${index + 1}次破局。\n主角：留下证据。`).join("\n"),
    userConfirmedFullScript: true
  },
  coverage: detectScriptCoverage(Array.from({ length: 5 }, (_, index) => `第${index + 1}集\n△主角第${index + 1}次破局。\n主角：留下证据。`).join("\n"), 5, { userConfirmedFullScript: true }),
  episodeChunkAnalyses: [
    analyzeEpisodeChunk({ projectTitle: "短完整剧", episodeNo: 1, episodeText: "第一集\n△主角破局。\n主角：留下证据。" }),
    analyzeEpisodeChunk({ projectTitle: "短完整剧", episodeNo: 2, episodeText: "第二集\n△反派追击。\n主角：反证成立。" })
  ],
  failedChunks: []
});
assert.equal(successfulAggregate.sourceMeta.failedChunks.length, 0);
assert.equal(successfulAggregate.sourceMeta.chunkedAnalysis, true);
assert.equal(successfulAggregate.sourceMeta.usableForSkillLearning, successfulAggregate.sourceMeta.evidenceValidation.invalidEvidenceRatio === 0 && !successfulAggregate.sourceMeta.needsReview);
const gatedAnalysis = { coverage: { inputType: "full_script" }, sourceMeta: { failedChunks: [], missingChunks: [{ episodeNo: 5 }], evidenceValidation: { invalidEvidenceRatio: 0 } } };
applyLongScriptGateFlags(gatedAnalysis);
assert.equal(gatedAnalysis.sourceMeta.needsReview, true);
assert.equal(gatedAnalysis.sourceMeta.usableForProduction, false);
assert.equal(gatedAnalysis.sourceMeta.usableForFullScriptCase, false);
const coverageGapAnalysis = { coverage: { inputType: "full_script" }, sourceMeta: { expectedChunks: 50, detectedChunks: 1, failedChunks: [], missingChunks: [], evidenceValidation: { invalidEvidenceRatio: 0 } } };
applyLongScriptGateFlags(coverageGapAnalysis);
assert.equal(coverageGapAnalysis.sourceMeta.needsReview, true);
assert.equal(coverageGapAnalysis.sourceMeta.completeAggregation, false);
const localFallbackGate = { coverage: { inputType: "full_script" }, sourceMeta: { localAggregateFallback: true, failedChunks: [], missingChunks: [], evidenceValidation: { invalidEvidenceRatio: 0 } } };
applyLongScriptGateFlags(localFallbackGate);
assert.equal(localFallbackGate.sourceMeta.needsReview, true);
assert.equal(localFallbackGate.sourceMeta.usableForSkillLearning, false);
assert.equal(localFallbackGate.sourceMeta.usableForProduction, false);
assert.equal(localFallbackGate.sourceMeta.usableForFullScriptCase, false);
const skippedGate = { coverage: { inputType: "full_script" }, sourceMeta: { skippedChunks: [{ episodeNo: 4, skippedDueToJsonFailure: true }], failedChunks: [], missingChunks: [], evidenceValidation: { invalidEvidenceRatio: 0 } } };
applyLongScriptGateFlags(skippedGate);
assert.equal(skippedGate.sourceMeta.needsReview, true);
assert.equal(skippedGate.sourceMeta.usableForSkillLearning, false);
assert.equal(skippedGate.sourceMeta.completeAggregation, false);
const schemaRepairRouteGate = { coverage: { inputType: "full_script" }, sourceMeta: { taskRouteHealthUsedSchemaRepair: true, failedChunks: [], missingChunks: [], evidenceValidation: { invalidEvidenceRatio: 0 } } };
applyLongScriptGateFlags(schemaRepairRouteGate);
assert.equal(schemaRepairRouteGate.sourceMeta.needsReview, true);
assert.equal(schemaRepairRouteGate.sourceMeta.usableForSkillLearning, false);
assert.equal(schemaRepairRouteGate.sourceMeta.usableForFullScriptCase, false);
assert.equal(schemaRepairRouteGate.sourceMeta.usableForProduction, false);
assert.ok(schemaRepairRouteGate.sourceMeta.warnings.some((item) => item.includes("依赖 schema repair 才通过")));
const signatureA = createLongScriptInputSignature({ text: "第一集\n内容", episodeCount: 1, userConfirmedFullScript: false });
const signatureB = createLongScriptInputSignature({ text: "第一集\n内容", episodeCount: 1, userConfirmedFullScript: false });
const signatureC = createLongScriptInputSignature({ text: "第一集\n内容已改", episodeCount: 1, userConfirmedFullScript: false });
assert.equal(sameLongScriptInputSignature(signatureA, signatureB), true);
assert.equal(sameLongScriptInputSignature(signatureA, signatureC), false);
const forgedAnalysis = structuredClone(fragmentAnalysis);
forgedAnalysis.episodeBeatLedger[0].sourceText = "这是一段完全不存在于原文中的伪造证据。";
forgedAnalysis.hookAnalysis.evidenceBeatIds = [forgedAnalysis.episodeBeatLedger[0].beatId];
forgedAnalysis.hookAnalysis.inferenceLevel = "原文明确";
const forgedValidation = validateEvidenceSourceText(forgedAnalysis, fragmentText);
assert.ok(forgedValidation.invalidEvidenceRatio > 0);
applyEvidenceValidationToAnalysis(forgedAnalysis, fragmentText);
assert.notEqual(forgedAnalysis.hookAnalysis.inferenceLevel, "原文明确");
const heavilyForged = structuredClone(fragmentAnalysis);
heavilyForged.episodeBeatLedger = heavilyForged.episodeBeatLedger.map((beat, index) => ({ ...beat, sourceText: `伪造证据 ${index}` }));
for (const key of ["hookEvidence", "goldfingerEvidence", "suspenseEvidence", "conflictBeats", "characterMentions"]) {
  heavilyForged.evidenceLedger[key] = (heavilyForged.evidenceLedger[key] || []).map((item, index) => ({ ...item, sourceText: `伪造 evidence ${key} ${index}` }));
}
applyEvidenceValidationToAnalysis(heavilyForged, fragmentText);
assert.equal(heavilyForged.sourceMeta.blockedSave, true);
assert.ok(heavilyForged.sourceMeta.evidenceValidation.invalidEvidenceRatio > 0.5);
const missingSourceAnalysis = structuredClone(fragmentAnalysis);
missingSourceAnalysis.episodeBeatLedger[0].sourceText = "";
missingSourceAnalysis.hookAnalysis.evidenceBeatIds = [missingSourceAnalysis.episodeBeatLedger[0].beatId];
missingSourceAnalysis.hookAnalysis.inferenceLevel = "原文明确";
applyEvidenceValidationToAnalysis(missingSourceAnalysis, fragmentText);
assert.ok(missingSourceAnalysis.sourceMeta.evidenceValidation.invalidEvidenceRatio > 0);
assert.equal(missingSourceAnalysis.episodeBeatLedger[0].invalidSourceText, true);
assert.notEqual(missingSourceAnalysis.hookAnalysis.inferenceLevel, "原文明确");
const missingEvidenceSource = structuredClone(fragmentAnalysis);
missingEvidenceSource.evidenceLedger.hookEvidence[0].sourceText = "";
applyEvidenceValidationToAnalysis(missingEvidenceSource, fragmentText);
assert.ok(missingEvidenceSource.sourceMeta.evidenceValidation.invalidEvidenceRatio > 0);
assert.equal(missingEvidenceSource.evidenceLedger.hookEvidence[0].invalidSourceText, true);
const declaredWithoutLedger = structuredClone(fragmentAnalysis);
declaredWithoutLedger.episodeBeatLedger = [];
declaredWithoutLedger.evidenceLedger = { hookEvidence: [], goldfingerEvidence: [], suspenseEvidence: [], endingEvidence: [], conflictBeats: [], characterMentions: [], episodeEvidence: [], scenes: [] };
declaredWithoutLedger.hookAnalysis.evidenceBeatIds = ["B404"];
applyEvidenceValidationToAnalysis(declaredWithoutLedger, fragmentText);
assert.equal(declaredWithoutLedger.sourceMeta.blockedSave, true);
assert.equal(declaredWithoutLedger.sourceMeta.evidenceValidation.invalidEvidenceRatio, 1);
assert.equal(fragmentAnalysis.sourceMeta.usableForCaseSave, true);
assert.equal(fragmentAnalysis.sourceMeta.usableForFullScriptCase, false);
assert.equal(fragmentAnalysis.sourceMeta.usableForSkillLearning, false);
const primitiveEvidenceText = "△火车上林清突然流血倒地。";
const normalizedPrimitiveEvidence = normalizeEvidenceEntry(primitiveEvidenceText, { group: "hookEvidence", index: 0 });
assert.equal(normalizedPrimitiveEvidence.sourceText, primitiveEvidenceText);
assert.equal(normalizedPrimitiveEvidence.summary, primitiveEvidenceText);
assert.ok(normalizedPrimitiveEvidence.id.startsWith("E_HOOK_"));
assert.equal(normalizedPrimitiveEvidence.normalizedFromPrimitive, true);
const normalizedPrimitiveBeat = normalizeBeatEntry("火车危机", 0);
assert.equal(normalizedPrimitiveBeat.sourceText, "火车危机");
assert.equal(normalizedPrimitiveBeat.beatSummary, "火车危机");
assert.equal(normalizedPrimitiveBeat.normalizedFromPrimitive, true);
const primitiveEvidenceAnalysis = structuredClone(fragmentAnalysis);
primitiveEvidenceAnalysis.evidenceLedger.hookEvidence = [primitiveEvidenceText];
primitiveEvidenceAnalysis.sourceMeta = { usableForSkillLearning: true, usableForLearning: true };
const primitiveValidation = validateEvidenceSourceText(primitiveEvidenceAnalysis, fragmentText);
assert.ok(primitiveValidation.validCount > 0);
assert.equal(typeof primitiveEvidenceAnalysis.evidenceLedger.hookEvidence[0], "object");
assert.equal(primitiveEvidenceAnalysis.evidenceLedger.hookEvidence[0].sourceText, primitiveEvidenceText);
assert.equal(primitiveEvidenceAnalysis.evidenceLedger.hookEvidence[0].summary, primitiveEvidenceText);
assert.equal(primitiveEvidenceAnalysis.evidenceLedger.hookEvidence[0].normalizedFromPrimitive, true);
applyEvidenceValidationToAnalysis(primitiveEvidenceAnalysis, fragmentText);
assert.ok(primitiveEvidenceAnalysis.sourceMeta.normalizedEvidenceEntries > 0);
assert.equal(primitiveEvidenceAnalysis.sourceMeta.needsReview, true);
assert.equal(primitiveEvidenceAnalysis.sourceMeta.usableForSkillLearning, false);
assert.equal(primitiveEvidenceAnalysis.sourceMeta.usableForLearning, false);
const primitiveBeatAnalysis = structuredClone(fragmentAnalysis);
primitiveBeatAnalysis.episodeBeatLedger = ["火车危机"];
assert.doesNotThrow(() => validateEvidenceSourceText(primitiveBeatAnalysis, fragmentText));
assert.equal(typeof primitiveBeatAnalysis.episodeBeatLedger[0], "object");
assert.equal(primitiveBeatAnalysis.episodeBeatLedger[0].beatSummary, "火车危机");
assert.equal(primitiveBeatAnalysis.episodeBeatLedger[0].normalizedFromPrimitive, true);
const malformedEvidenceAnalysis = structuredClone(fragmentAnalysis);
malformedEvidenceAnalysis.evidenceLedger.hookEvidence = [null, 123, false];
assert.doesNotThrow(() => validateEvidenceSourceText(malformedEvidenceAnalysis, fragmentText));
assert.ok(malformedEvidenceAnalysis.evidenceLedger.hookEvidence.every((item) => typeof item === "object"));
assert.ok(malformedEvidenceAnalysis.evidenceLedger.hookEvidence.every((item) => item.needsReview || item.invalidSourceText));

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
const prefixedJson = extractJsonCandidate('作为剧本结构顾问，我先说明：{"ok":true,"items":[1,2]}谢谢。');
assert.equal(prefixedJson.extractionMethod, "brace_match");
assert.deepEqual(JSON.parse(prefixedJson.candidate), { ok: true, items: [1, 2] });
const fencedJson = extractJsonCandidate("```json\n{\"ok\":true}\n```");
assert.equal(fencedJson.extractionMethod, "fenced_json");
assert.deepEqual(JSON.parse(fencedJson.candidate), { ok: true });
const multiJsonText =
  `示例：${JSON.stringify({ ok: true, notes: Array(20).fill("wrong") })}\n` +
  `正式结果：${JSON.stringify({
    episodeNo: 1,
    evidenceLedger: {
      hookEvidence: [{ id: "E001", sourceText: "火车上，林清韵忽然吐血。", summary: "危机", relatedBeatIds: ["B001"] }]
    },
    episodeBeatLedger: [{ beatId: "B001", sourceText: "火车上，林清韵忽然吐血。", beatSummary: "火车危机" }],
    episodeFunctionAnalysis: { episodeNo: 1, summary: "火车危机", openingHook: "吐血", evidenceBeatIds: ["B001"] }
  })}`;
assert.ok(extractJsonCandidates(multiJsonText).length >= 2);
const taskAwareJson = extractTaskJsonCandidate(multiJsonText, "analyzeEpisodeChunk");
assert.equal(JSON.parse(taskAwareJson.candidate).episodeNo, 1);
assert.ok(Array.isArray(JSON.parse(taskAwareJson.candidate).episodeBeatLedger));
const emptyCompactShell = { episodeNo: 1, evidenceLedger: {}, episodeBeatLedger: [{}], episodeFunctionAnalysis: {} };
const validCompactShape = JSON.parse(taskAwareJson.candidate);
assert.equal(evaluateEpisodeChunkCompactShape(emptyCompactShell, { episodeText: "火车上，林清韵忽然吐血。" }).valid, false);
assert.equal(validateTaskOutput("analyzeEpisodeChunk", emptyCompactShell).ok, false);
assert.ok(scoreEpisodeChunkCandidate(validCompactShape) > scoreEpisodeChunkCandidate(emptyCompactShell));
const pseudoThenRealText = `候选：${JSON.stringify(emptyCompactShell)}\n正式：${JSON.stringify(validCompactShape)}`;
const pseudoSelected = extractTaskJsonCandidate(pseudoThenRealText, "analyzeEpisodeChunk");
assert.equal(JSON.parse(pseudoSelected.candidate).episodeBeatLedger[0].beatId, "B001");

const deepSeekTemplate = createDeepSeekTemplate();
assert.equal(deepSeekTemplate.provider.providerType, "deepseek");
assert.equal(deepSeekTemplate.provider.requestFormat, "openai_chat");
assert.ok(deepSeekTemplate.models.some((model) => model.modelName === "deepseek-chat"));
assert.ok(deepSeekTemplate.models.every((model) => model.supportsJsonMode === false));
const templatedConfig = applyProviderTemplate(state.apiConfig, "deepseek");
assert.equal(templatedConfig.providers[0].providerType, "deepseek");

const switchedConfig = switchCoreRoutesToModel(apiStateLike(state.apiConfig), "model-openai-compatible-default");
assert.equal(switchedConfig.globalDefaultModelId, "model-openai-compatible-default");
assert.ok(coreRouteTaskTypes.includes("schemaRepairAnalyzeEpisodeChunk"));
assert.ok(coreRouteTaskTypes.includes("schemaRepairAnalyzeScript"));
assert.ok(coreRouteTaskTypes.includes("jsonRepair"));
for (const taskType of coreRouteTaskTypes) {
  assert.equal(switchedConfig.routes.find((route) => route.taskType === taskType)?.primaryModelId, "model-openai-compatible-default");
}
const switchedRepairRoute = switchedConfig.routes.find((route) => route.taskType === "schemaRepairAnalyzeEpisodeChunk");
assert.equal(switchedRepairRoute.primaryModelId, "model-openai-compatible-default");
assert.ok(switchedRepairRoute.timeoutMs >= 180000);
assert.ok(defaultTimeoutForTask("analyzeScript") >= 180000);
assert.ok(defaultTimeoutForTask("analyzeEpisodeChunk") >= 180000);
assert.ok(defaultTimeoutForTask("schemaRepairAnalyzeEpisodeChunk") >= 180000);
assert.ok(defaultTimeoutForTask("aggregateScriptAnalysis") >= 240000);
assert.ok(defaultTimeoutForTask("jsonRepair") >= 120000);
const preserveHighTimeoutConfig = switchCoreRoutesToModel(
  {
    ...apiStateLike(state.apiConfig),
    routes: apiStateLike(state.apiConfig).routes.map((route) =>
      route.taskType === "analyzeEpisodeChunk" ? { ...route, timeoutMs: 200000 } : route
    )
  },
  "model-openai-compatible-default"
);
assert.equal(preserveHighTimeoutConfig.routes.find((route) => route.taskType === "analyzeEpisodeChunk").timeoutMs, 200000);

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
assert.equal(clampMaxOutputTokens(200000, "analyzeEpisodeChunk"), 6000);
assert.equal(clampMaxOutputTokens(200000, "aggregateScriptAnalysis"), 12000);
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
assert.equal(apiSuccessResult.usableForLearning, true);
assert.equal(apiSuccessResult.usableForProduction, true);
assert.equal(proxyCalls.length, 1);
assert.equal(proxyCalls[0].requestFormat, "openai_chat");
assert.equal(proxyCalls[0].providerId, "provider-openai-compatible-template");
assert.equal(proxyCalls[0].modelId, "model-openai-compatible-default");
assert.equal(Object.hasOwn(proxyCalls[0], "provider"), false);
assert.equal(Object.hasOwn(proxyCalls[0], "model"), false);
delete globalThis.__MODEL_CALL_PROXY__;

const scriptDraftInput = {
  ...apiSuccessState.scriptInput,
  title: "用户填写标题",
  genre: "都市 / 重生 / 复仇",
  episodeCount: 24,
  text: "毒手巫医\n第一集\n主角在危机中重生。"
};
const wrappedCompleteAnalysisCalls = [];
globalThis.__MODEL_CALL_PROXY__ = async (payload) => {
  wrappedCompleteAnalysisCalls.push(payload);
  const complete = analyzeScript({ ...scriptDraftInput, title: "模型自带标题", genre: "悬疑" });
  complete.basicInfo.genre = ["悬疑"];
  complete.classificationTags.genre = ["悬疑"];
  return {
    outputText: JSON.stringify({ result: { scriptAnalysis: complete } }),
    tokenUsage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
    requestFormat: payload.requestFormat,
    endpointType: "server_proxy",
    status: 200
  };
};
const wrappedCompleteAnalysisResult = await callModel({
  taskType: "analyzeScript",
  featureArea: "剧本分析中心",
  inputMeta: scriptDraftInput,
  state: apiSuccessState
});
assert.equal(wrappedCompleteAnalysisResult.success, true);
assert.equal(wrappedCompleteAnalysisResult.blockedSave, false);
assert.equal(wrappedCompleteAnalysisCalls.length, 1);
assert.equal(wrappedCompleteAnalysisResult.parsedJson.basicInfo.title, "用户填写标题");
assert.deepEqual(wrappedCompleteAnalysisResult.parsedJson.basicInfo.genre, ["都市", "重生", "复仇"]);
assert.deepEqual(wrappedCompleteAnalysisResult.parsedJson.classificationTags.genre, ["都市", "重生", "复仇", "悬疑"]);
assert.equal(wrappedCompleteAnalysisResult.parsedJson.basicInfo.userGenreNote, "都市 / 重生 / 复仇");
assert.equal(wrappedCompleteAnalysisResult.parsedJson.basicInfo.episodeCount, 24);
assert.deepEqual(wrappedCompleteAnalysisResult.schemaMeta.unwrapPath, ["result", "scriptAnalysis"]);
assert.ok(wrappedCompleteAnalysisResult.warnings.some((warning) => warning.includes("result.scriptAnalysis")));
delete globalThis.__MODEL_CALL_PROXY__;

const episodeJsonCalls = [];
globalThis.__MODEL_CALL_PROXY__ = async (payload) => {
  episodeJsonCalls.push(payload);
  return {
    outputText:
      "作为剧本结构顾问，我先给出结果：" +
      JSON.stringify({
        episodeNo: 1,
        title: "第一集",
        evidenceLedger: {
          hookEvidence: [
            {
              id: "E001",
              episodeNo: 1,
              sourceText: "火车上，林清韵忽然吐血。孙大为看出她中了蛊毒。",
              summary: "火车危机与蛊毒识别",
              evidenceType: "hook",
              relatedBeatIds: ["B001"],
              confidence: 0.8
            }
          ]
        },
        episodeBeatLedger: [
          {
            beatId: "B001",
            episodeNo: 1,
            sourceText: "火车上，林清韵忽然吐血。孙大为看出她中了蛊毒。",
            beatSummary: "林清韵吐血，孙大为识别蛊毒",
            characters: ["林清韵", "孙大为"],
            audienceEmotion: ["危机", "好奇"],
            suspenseQuestion: "孙大为如何救人？",
            structureFunction: "开头钩子",
            confidence: 0.85
          }
        ],
        episodeFunctionAnalysis: {
          episodeNo: 1,
          summary: "火车突发蛊毒危机",
          openingHook: "公共空间突发危机",
          mainConflict: "病危与识毒",
          coolMoment: "孙大为看出蛊毒",
          informationGain: "主角懂蛊",
          characterFunction: "展示主角能力",
          cliffhanger: "蛊毒来源待查",
          evidenceBeatIds: ["B001"],
          inferenceLevel: "原文明确",
          confidence: 0.85,
          riskNotes: []
        },
        reusablePatterns: [],
        openQuestions: ["谁下的蛊？"],
        continuityNotes: [],
        confidence: 0.85,
        needsReview: false
      }),
    tokenUsage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
    requestFormat: payload.requestFormat,
    endpointType: "server_proxy",
    status: 200
  };
};
const episodeJsonResult = await callModel({
  taskType: "analyzeEpisodeChunk",
  featureArea: "剧本分析中心",
  inputMeta: {
    projectTitle: "分集 JSON 测试",
    episodeNo: 1,
    episodeTitle: "第一集",
    episodeText: "第一集\n火车上，林清韵忽然吐血。孙大为看出她中了蛊毒。"
  },
  schema: true,
  state: apiSuccessState
});
assert.equal(episodeJsonResult.success, true);
assert.equal(episodeJsonResult.jsonExtractionMethod, "brace_match");
assert.ok(episodeJsonResult.warnings.some((warning) => warning.includes("已自动提取 JSON 主体")));
assert.equal(episodeJsonResult.parsedJson.episodeNo, 1);
assert.ok((episodeJsonResult.parsedJson.sourceMeta.evidenceValidation.validCount || 0) >= 1);
assert.equal(episodeJsonCalls.length, 1);
delete globalThis.__MODEL_CALL_PROXY__;

globalThis.__MODEL_CALL_PROXY__ = async (payload) => ({
  outputText:
    `示例：${JSON.stringify({ ok: true, notes: Array(40).fill("这不是目标结构") })}\n` +
    `正式结果：${JSON.stringify({
      episodeNo: 1,
      title: "第一集",
      evidenceLedger: {
        hookEvidence: [
          {
            id: "E001",
            sourceText: "火车上，林清韵忽然吐血。",
            summary: "火车突发危机",
            evidenceType: "hook",
            relatedBeatIds: ["B001"],
            confidence: 0.85
          }
        ],
        conflictBeats: [],
        suspenseEvidence: [],
        episodeEvidence: []
      },
      episodeBeatLedger: [
        {
          beatId: "B001",
          episodeNo: 1,
          sourceText: "火车上，林清韵忽然吐血。",
          beatSummary: "火车突发危机",
          characters: ["林清韵", "孙大为"],
          audienceEmotion: ["紧张"],
          suspenseQuestion: "她为什么吐血？",
          structureFunction: "开头钩子",
          confidence: 0.85
        }
      ],
      episodeFunctionAnalysis: {
        episodeNo: 1,
        summary: "火车突发危机",
        openingHook: "林清韵忽然吐血",
        mainConflict: "病危与识毒",
        coolMoment: "孙大为看出蛊毒",
        informationGain: "主角懂蛊",
        characterFunction: "展示主角能力",
        cliffhanger: "蛊毒来源待查",
        evidenceBeatIds: ["B001"],
        inferenceLevel: "原文明确",
        confidence: 0.85,
        riskNotes: []
      },
      reusablePatterns: [],
      openQuestions: ["谁下的蛊？"],
      continuityNotes: [],
      confidence: 0.85,
      needsReview: false
    })}`,
  tokenUsage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
  requestFormat: payload.requestFormat,
  endpointType: "server_proxy",
  status: 200
});
const taskAwareEpisodeResult = await callModel({
  taskType: "analyzeEpisodeChunk",
  featureArea: "剧本分析中心",
  inputMeta: {
    projectTitle: "分集 JSON 测试",
    episodeNo: 1,
    episodeTitle: "第一集",
    episodeText: "第一集\n火车上，林清韵忽然吐血。孙大为看出她中了蛊毒。"
  },
  schema: true,
  state: apiSuccessState
});
assert.equal(taskAwareEpisodeResult.success, true);
assert.equal(taskAwareEpisodeResult.parsedJson.episodeNo, 1);
assert.ok(Array.isArray(taskAwareEpisodeResult.parsedJson.episodeBeatLedger));
delete globalThis.__MODEL_CALL_PROXY__;

globalThis.__MODEL_CALL_PROXY__ = async (payload) => ({
  outputText: JSON.stringify({ foo: "bar" }),
  tokenUsage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
  requestFormat: payload.requestFormat,
  endpointType: "server_proxy",
  status: 200
});
const invalidEpisodeShapeResult = await callModel({
  taskType: "analyzeEpisodeChunk",
  featureArea: "剧本分析中心",
  inputMeta: {
    projectTitle: "分集 JSON 测试",
    episodeNo: 1,
    episodeTitle: "第一集",
    episodeText: "第一集\n火车上，林清韵忽然吐血。孙大为看出她中了蛊毒。"
  },
  schema: true,
  state: apiSuccessState
});
assert.equal(invalidEpisodeShapeResult.success, false);
assert.equal(invalidEpisodeShapeResult.errorType, "schema_validation");
assert.ok(invalidEpisodeShapeResult.error.includes("不能用本地补齐结果冒充真实分集分析"));
delete globalThis.__MODEL_CALL_PROXY__;

globalThis.__MODEL_CALL_PROXY__ = async (payload) => ({
  outputText: JSON.stringify({ episodeNo: 1, evidenceLedger: {}, episodeBeatLedger: [{}], episodeFunctionAnalysis: {} }),
  tokenUsage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
  requestFormat: payload.requestFormat,
  endpointType: "server_proxy",
  status: 200
});
const emptyEpisodeShellResult = await callModel({
  taskType: "analyzeEpisodeChunk",
  featureArea: "剧本分析中心",
  inputMeta: {
    projectTitle: "分集 JSON 测试",
    episodeNo: 1,
    episodeTitle: "第一集",
    episodeText: "第一集\n火车上，林清韵忽然吐血。孙大为看出她中了蛊毒。"
  },
  schema: true,
  state: apiSuccessState
});
assert.equal(emptyEpisodeShellResult.success, false);
assert.equal(emptyEpisodeShellResult.errorType, "schema_validation");
assert.ok(emptyEpisodeShellResult.error.includes("结构空壳") || emptyEpisodeShellResult.error.includes("有效 beat"));
assert.ok(emptyEpisodeShellResult.parsedJson?.episodeAnalysis === undefined);
delete globalThis.__MODEL_CALL_PROXY__;

globalThis.__MODEL_CALL_PROXY__ = async (payload) => ({
  outputText: JSON.stringify({
    episodeAnalysis: [
      {
        episodeNo: 1,
        structuralAnalysis: {
          openingHook: "林清韵忽然吐血",
          conflictProgression: "危机与识毒",
          pacing: "开场直接进入危机"
        }
      }
    ]
  }),
  tokenUsage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
  requestFormat: payload.requestFormat,
  endpointType: "server_proxy",
  status: 200
});
const legacyEpisodeShapeResult = await callModel({
  taskType: "analyzeEpisodeChunk",
  featureArea: "剧本分析中心",
  inputMeta: {
    projectTitle: "分集 JSON 测试",
    episodeNo: 1,
    episodeTitle: "第一集",
    episodeText: "第一集\n火车上，林清韵忽然吐血。孙大为看出她中了蛊毒。"
  },
  schema: true,
  state: apiSuccessState
});
assert.equal(legacyEpisodeShapeResult.success, false);
assert.equal(legacyEpisodeShapeResult.errorType, "schema_validation");
assert.ok(legacyEpisodeShapeResult.parsedJson?.episodeAnalysis || legacyEpisodeShapeResult.parsedJson?.structuralAnalysis);
assert.ok(legacyEpisodeShapeResult.schemaIssues.length > 0);
delete globalThis.__MODEL_CALL_PROXY__;

globalThis.__MODEL_CALL_PROXY__ = async (payload) => ({
  outputText: JSON.stringify({
    episodeNo: 1,
    title: "第一集",
    evidenceLedger: {
      hookEvidence: [
        {
          id: "E001",
          sourceText: "火车上，林清韵忽然吐血。",
          summary: "火车突发危机",
          evidenceType: "hook",
          relatedBeatIds: ["B001"],
          confidence: 0.85
        }
      ],
      conflictBeats: [],
      suspenseEvidence: [],
      episodeEvidence: []
    },
    episodeBeatLedger: [
      {
        beatId: "B001",
        episodeNo: 1,
        sourceText: "火车上，林清韵忽然吐血。",
        beatSummary: "火车危机",
        characters: ["林清韵", "孙大为"],
        audienceEmotion: ["紧张"],
        suspenseQuestion: "她为何吐血？",
        structureFunction: "开头钩子",
        confidence: 0.85
      }
    ],
    episodeFunctionAnalysis: {
      episodeNo: 1,
      summary: "火车危机",
      openingHook: "林清韵吐血",
      mainConflict: "中蛊危机与识别能力",
      informationGain: "孙大为懂蛊毒",
      characterFunction: "展示主角能力",
      evidenceBeatIds: ["B001"],
      inferenceLevel: "原文明确",
      confidence: 0.85,
      riskNotes: []
    },
    reusablePatterns: [],
    openQuestions: [],
    continuityNotes: [],
    confidence: 0.85,
    needsReview: false
  }),
  tokenUsage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
  requestFormat: payload.requestFormat,
  endpointType: "server_proxy",
  status: 200
});
const episodeRepairResult = await callModel({
  taskType: "schemaRepairAnalyzeEpisodeChunk",
  featureArea: "JSON 修复",
  inputMeta: {
    projectTitle: "分集 JSON 测试",
    episodeNo: 1,
    episodeTitle: "第一集",
    episodeText: "第一集\n火车上，林清韵忽然吐血。孙大为看出她中了蛊毒。",
    rawModelJson: legacyEpisodeShapeResult.parsedJson,
    schemaIssues: legacyEpisodeShapeResult.schemaIssues
  },
  schema: true,
  state: apiSuccessState
});
assert.equal(episodeRepairResult.success, true);
assert.equal(episodeRepairResult.parsedJson.episodeFunctionAnalysis.evidenceBeatIds[0], "B001");
delete globalThis.__MODEL_CALL_PROXY__;

globalThis.__MODEL_CALL_PROXY__ = async (payload) => ({
  outputText: JSON.stringify({
    episodeNo: 1,
    title: "第一集",
    evidenceLedger: [
      {
        sourceText: "火车上，林清韵忽然吐血。",
        observableEvent: "林清韵在火车上突然吐血",
        possibleMeanings: ["开头危机", "强钩子"],
        confidence: "high"
      },
      {
        sourceText: "孙大为看出她中了蛊毒。",
        claim: "孙大为具有识别蛊毒的特殊能力",
        confidence: 0.8
      }
    ],
    episodeFunctionAnalysis: {
      episodeNo: 1,
      summary: "火车吐血危机引出主角识别蛊毒的能力。",
      openingHook: "林清韵突然吐血。",
      mainConflict: "蛊毒危机与无人识破之间的冲突。",
      informationGain: "孙大为能看出蛊毒。",
      characterFunction: "展示孙大为的特殊判断能力。",
      confidence: 0.78,
      riskNotes: []
    },
    reusablePatterns: [],
    openQuestions: [],
    continuityNotes: [],
    confidence: 0.72,
    needsReview: false
  }),
  tokenUsage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
  requestFormat: payload.requestFormat,
  endpointType: "server_proxy",
  status: 200
});
const arrayEvidenceRepairResult = await callModel({
  taskType: "schemaRepairAnalyzeEpisodeChunk",
  featureArea: "JSON 修复",
  inputMeta: {
    projectTitle: "分集 JSON 测试",
    episodeNo: 1,
    episodeTitle: "第一集",
    episodeText: "第一集\n火车上，林清韵忽然吐血。孙大为看出她中了蛊毒。",
    rawModelJson: legacyEpisodeShapeResult.parsedJson,
    schemaIssues: legacyEpisodeShapeResult.schemaIssues
  },
  schema: true,
  state: apiSuccessState
});
assert.equal(arrayEvidenceRepairResult.success, true);
assert.equal(Array.isArray(arrayEvidenceRepairResult.parsedJson.evidenceLedger), false);
assert.ok(arrayEvidenceRepairResult.parsedJson.evidenceLedger.hookEvidence.length >= 1);
assert.ok(arrayEvidenceRepairResult.parsedJson.episodeBeatLedger.length >= 1);
assert.ok(arrayEvidenceRepairResult.parsedJson.episodeFunctionAnalysis.evidenceBeatIds.length >= 1);
assert.equal(arrayEvidenceRepairResult.parsedJson.sourceMeta.normalizedEvidenceLedgerArray, true);
assert.equal(arrayEvidenceRepairResult.parsedJson.needsReview, true);
delete globalThis.__MODEL_CALL_PROXY__;

globalThis.__MODEL_CALL_PROXY__ = async (payload) => ({
  outputText: JSON.stringify({
    episodeNo: 1,
    title: "第一集",
    evidenceLedger: {
      蛊毒事件: [
        {
          evidence: "林清韵忽然吐血",
          source: "episodeText",
          certainty: "observed",
          notes: "症状符合蛊毒表征，但未交代中毒原因与施害者"
        }
      ]
    },
    episodeBeatLedger: [
      {
        beatNo: 1,
        type: "opening_hook",
        description: "火车上林清韵突然吐血，制造强危机与身体异常悬念",
        function: "吸引观众注意，暗示前世/今生阴谋"
      }
    ],
    episodeFunctionAnalysis: {
      人物功能: [{ character: "林清韵", function: "承受意外攻击" }],
      openingHook: "林清韵忽然吐血",
      mainConflict: "蛊毒危机与无人能解",
      summary: "火车吐血危机开场。"
    },
    reusablePatterns: [],
    openQuestions: [],
    continuityNotes: [],
    confidence: 0.72,
    needsReview: false
  }),
  tokenUsage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
  requestFormat: payload.requestFormat,
  endpointType: "server_proxy",
  status: 200
});
const customEvidenceRepairResult = await callModel({
  taskType: "schemaRepairAnalyzeEpisodeChunk",
  featureArea: "JSON 修复",
  inputMeta: {
    projectTitle: "分集 JSON 测试",
    episodeNo: 1,
    episodeTitle: "第一集",
    episodeText: "第一集\n火车上，林清韵忽然吐血。孙大为看出她中了蛊毒。",
    rawModelJson: legacyEpisodeShapeResult.parsedJson,
    schemaIssues: legacyEpisodeShapeResult.schemaIssues
  },
  schema: true,
  state: apiSuccessState
});
assert.equal(customEvidenceRepairResult.success, true);
assert.equal(Array.isArray(customEvidenceRepairResult.parsedJson.evidenceLedger), false);
assert.ok(customEvidenceRepairResult.parsedJson.evidenceLedger.hookEvidence.length >= 1);
assert.ok(customEvidenceRepairResult.parsedJson.episodeBeatLedger.length >= 1);
assert.ok(customEvidenceRepairResult.parsedJson.episodeFunctionAnalysis.evidenceBeatIds.length >= 1);
assert.equal(customEvidenceRepairResult.parsedJson.sourceMeta.normalizedEvidenceLedgerCustomGroups, true);
assert.equal(customEvidenceRepairResult.parsedJson.needsReview, true);
delete globalThis.__MODEL_CALL_PROXY__;

const wrappedAnalysisCalls = [];
globalThis.__MODEL_CALL_PROXY__ = async (payload) => {
  wrappedAnalysisCalls.push(payload);
  return {
    outputText:
      "```json\n" +
      JSON.stringify({
        data: {
          output: {
            scriptAnalysis: {
              title: "模型自带标题",
              structureFunction: {
                hook: "开局直接给出可追看的命运危机。",
                pacing: "前 5 集建立压迫和小反击，中段转向主线真相。",
                riskAssessment: ["模型返回了非标准字段，需要补齐结构档案。"]
              }
            }
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
assert.equal(wrappedAnalysisResult.blockedSave, true);
assert.equal(wrappedAnalysisResult.needsReview, true);
assert.equal(wrappedAnalysisResult.usableForLearning, false);
assert.equal(wrappedAnalysisResult.parsedJson.usableForLearning, false);
assert.ok(wrappedAnalysisResult.modelCompletenessScore < 60);
assert.deepEqual(wrappedAnalysisResult.schemaMeta.unwrapPath, ["data", "output", "scriptAnalysis"]);
assert.ok(wrappedAnalysisResult.schemaMeta.localFallbackSections.length >= 3);
assert.ok(wrappedAnalysisResult.schemaMeta.userPreservedFields.includes("basicInfo.title"));
assert.ok(wrappedAnalysisResult.warnings.some((warning) => warning.includes("data.output.scriptAnalysis")));
assert.ok(wrappedAnalysisResult.warnings.some((warning) => warning.includes("阻止直接入库")));
delete globalThis.__MODEL_CALL_PROXY__;

globalThis.__MODEL_CALL_PROXY__ = async (payload) => {
  const complete = analyzeScript(scriptDraftInput);
  return {
    outputText: JSON.stringify({ basicInfo: complete.basicInfo, analysis: { scriptAnalysis: complete } }),
    tokenUsage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
    requestFormat: payload.requestFormat,
    endpointType: "server_proxy",
    status: 200
  };
};
const mixedRootResult = await callModel({
  taskType: "analyzeScript",
  featureArea: "剧本分析中心",
  inputMeta: scriptDraftInput,
  state: apiSuccessState
});
assert.equal(mixedRootResult.success, true);
assert.deepEqual(mixedRootResult.schemaMeta.unwrapPath, []);
assert.equal(mixedRootResult.blockedSave, true);
delete globalThis.__MODEL_CALL_PROXY__;

globalThis.__MODEL_CALL_PROXY__ = async (payload) => ({
  outputText: JSON.stringify({
    scriptAnalysis: {
      basicInfo: { title: "" },
      hookAnalysis: { riskNotes: [] },
      audienceNeedAnalysis: {},
      themeAnalysis: { themeStatement: "" },
      characterAnalysis: {},
      mainlineStructure: {},
      episodeFunctionAnalysis: [{ title: "" }],
      reusablePatterns: []
    }
  }),
  tokenUsage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
  requestFormat: payload.requestFormat,
  endpointType: "server_proxy",
  status: 200
});
const emptyShellResult = await callModel({
  taskType: "analyzeScript",
  featureArea: "剧本分析中心",
  inputMeta: scriptDraftInput,
  state: apiSuccessState
});
assert.equal(emptyShellResult.blockedSave, true);
assert.equal(emptyShellResult.schemaMeta.modelCompletenessScore, 0);
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
const timeoutSelectionState = structuredClone(apiState);
timeoutSelectionState.apiConfig.routes = timeoutSelectionState.apiConfig.routes.map((route) =>
  route.taskType === "analyzeEpisodeChunk" ? { ...route, primaryModelId: "model-openai-compatible-default", timeoutMs: 200000 } : route
);
const timeoutSelection = selectModelRoute({
  state: timeoutSelectionState,
  project: timeoutSelectionState.currentProject,
  taskType: "analyzeEpisodeChunk",
  featureArea: "剧本分析中心",
  matchedSkills: []
});
assert.equal(timeoutSelection.options.timeoutMs, 200000);
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

const schemaRepairDemo = await callModel({
  taskType: "schemaRepairAnalyzeScript",
  featureArea: "JSON 修复",
  inputMeta: scriptDraftInput,
  state
});
assert.equal(schemaRepairDemo.success, true);
assert.equal(schemaRepairDemo.mode, "demo");
assert.equal(schemaRepairDemo.parsedJson.sourceMeta.blockedSave, true);
assert.equal(schemaRepairDemo.parsedJson.usableForLearning, false);

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
assert.ok(failingResult.error.includes("当前接口不接受 OpenAI Chat Completions 请求体"));
assert.ok(failingResult.error.includes("不可重试原因"));
assert.equal(failingProxyCalls.length, 3);
assert.ok(failingProxyCalls.every((payload) => !Object.hasOwn(payload, "provider") && !Object.hasOwn(payload, "model")));
assert.ok(failingProxyCalls.every((payload) => Object.hasOwn(payload, "providerId") && Object.hasOwn(payload, "modelId")));
assert.equal(shouldRetryModelError(new Error("Failed to fetch")), true);
assert.equal(shouldRetryModelError(new Error("Provider 请求失败：429 rate limited")), true);
assert.equal(shouldRetryModelError(new Error("Provider 请求失败：503 unavailable")), true);
assert.equal(shouldRetryModelError(new Error("结构校验失败：缺少 directionCandidates")), false);
assert.equal(shouldRetryModelError(new Error("JSON 解析失败：Unexpected token 作")), false);
assert.equal(shouldRetryModelError(new Error("Provider 请求失败：400 Unknown name \"messages\"")), false);
assert.equal(classifyProviderError('Invalid JSON payload received. Unknown name "messages"'), "provider_protocol_mismatch");
assert.equal(classifyProviderError("未找到 Provider 配置。请先保存 Provider，再测试或调用。"), "missing_provider");
assert.equal(classifyProviderError("Provider 请求失败：429 Resource exhausted"), "provider_rate_limit");
assert.equal(classifyProviderError("结构校验失败：缺少 episodeBeatLedger"), "task_schema_failed");
const geminiMismatchDiagnostics = diagnoseProviderProtocol(
  { id: "p-gemini-bad", providerType: "openai_compatible", requestFormat: "openai_chat", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  { id: "m-gemini", modelName: "gemini-pro" }
);
assert.equal(geminiMismatchDiagnostics.severity, "error");
assert.ok(["openai_chat_to_gemini_native", "openai_compatible_to_gemini_native"].includes(geminiMismatchDiagnostics.likelyMismatch));
assert.ok(geminiMismatchDiagnostics.issues.join("；").includes("Gemini 官方接口"));
assert.ok(suggestProviderFix('Unknown name "messages"', { providerType: "openai_compatible" }, {}).join("；").includes("gemini_native"));
assert.ok(suggestProviderFix("Provider error: response_format unsupported", {}, {}).join("；").includes("supportsJsonMode"));
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
assert.ok(serverSource.includes("effectiveTimeoutMs"));
assert.ok(serverSource.includes("createEffectiveInvocationLog"));
assert.ok(serverSource.includes("diagnoseProviderProtocol"));
assert.ok(serverSource.includes("provider_protocol_mismatch"));
assert.ok(serverSource.includes("suggestions"));
assert.ok(serverSource.includes("appendServerProxyLog({ ...responseBody, source: \"test-provider\""));
const modelAdapterSource = await fs.readFile(new URL("../src/model-adapter.js", import.meta.url), "utf8");
assert.ok(modelAdapterSource.includes('fetch("/api/model-call"'));
assert.ok(modelAdapterSource.includes("providerId: provider?.id"));
assert.ok(modelAdapterSource.includes("taskType: taskType || null"));
assert.ok(modelAdapterSource.includes("shouldRetryModelError"));
assert.ok(modelAdapterSource.includes("testModelRoute"));
assert.ok(modelAdapterSource.includes("modelErrorRetryBlockReason"));
assert.ok(modelAdapterSource.includes("classifyProviderError"));
assert.ok(modelAdapterSource.includes("不可重试原因"));
assert.ok(!modelAdapterSource.includes("const payload = { provider, model"));
assert.ok(!modelAdapterSource.includes("callOpenAICompatible"));
assert.ok(!modelAdapterSource.includes("callGemini"));
assert.ok(modelAdapterSource.includes("requiresRouteFix"));
assert.ok(modelAdapterSource.includes("executeApiAttemptWithRetries"));
assert.ok(modelAdapterSource.includes("analyzeEpisodeChunk"));
assert.ok(modelAdapterSource.includes("aggregateScriptAnalysis"));
assert.ok(modelAdapterSource.includes("createEffectiveInvocation"));
assert.ok(modelAdapterSource.includes("effectiveTimeoutMs"));
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
assert.ok(appSource.includes("完整测试当前任务链路"));
assert.ok(appSource.includes("诊断 Provider 协议"));
assert.ok(appSource.includes("Provider 健康状态"));
assert.ok(appSource.includes("provider_ping"));
assert.ok(appSource.includes("chat_smoke"));
assert.ok(appSource.includes("json_smoke"));
assert.ok(appSource.includes("task_smoke"));
assert.ok(appSource.includes("ensureLongScriptTaskRoutesReady"));
assert.ok(appSource.includes("buildLongScriptExecutionPlan"));
assert.ok(appSource.includes("\"schemaRepairAnalyzeEpisodeChunk\", \"aggregateScriptAnalysis\""));
assert.ok(appSource.includes("隐藏修复任务也必须可用"));
assert.ok(appSource.includes("resolveExactTaskRouteBundle"));
assert.ok(appSource.includes("skippedDueToMissingProvider"));
assert.ok(appSource.includes("effectiveTimeoutMs="));
assert.ok(appSource.includes("任务：${escapeHtml(item.taskType || \"unknown\")"));
assert.ok(appSource.includes("validateTaskRouteHealthFresh"));
assert.ok(appSource.includes("createTaskRouteFingerprint"));
assert.ok(appSource.includes("baseUrlHash"));
assert.ok(appSource.includes("jsonModeRequired: Boolean(route.jsonModeRequired)"));
assert.ok(appSource.includes("timeoutMs: Number(route.timeoutMs"));
assert.ok(appSource.includes("maxOutputTokens: Number(route.maxOutputTokens"));
assert.ok(appSource.includes("resolvedRequestFormat"));
assert.ok(appSource.includes(".map((field) => `${field} 已变化`)"));
assert.ok(appSource.includes("showToast(readiness.warnings?.[0]"));
assert.ok(appSource.includes("配置已变化，请重新执行完整任务链路测试。"));
assert.ok(appSource.includes("测试已过期"));
assert.ok(appSource.includes("测试已过期："));
assert.ok(appSource.includes("renderTaskHealthStatus(health, config = null, taskType = \"\")"));
assert.ok(appSource.includes("validateTaskRouteHealthFresh(config, taskType, health)"));
assert.ok(appSource.includes("该模型暂不可用于 ${taskType} 的结构化 JSON 输出。"));
assert.ok(appSource.includes("该模型暂不可用于所测任务的结构化 JSON 输出。长剧本分析依赖 analyzeEpisodeChunk 和 aggregateScriptAnalysis。"));
assert.ok(appSource.includes("markTaskRouteHealthStale(state.apiConfig, \"Provider 配置已变化"));
assert.ok(appSource.includes("markTaskRouteHealthStale(state.apiConfig, \"模型配置已变化"));
assert.ok(appSource.includes("markTaskRouteHealthStale(state.apiConfig, \"路由配置已变化"));
assert.ok(appSource.includes("analyzeScript 测试通过不能代替"));
assert.ok(appSource.includes("analyzeEpisodeChunk JSON 输出测试未通过，已阻止长剧本分析"));
assert.ok(appSource.includes("skippedDueToProviderProtocolMismatch"));
assert.ok(appSource.includes("Provider 协议不匹配，已停止后续调用。"));
assert.ok(appSource.includes("provider_protocol_mismatch"));
assert.ok(appSource.includes('if (!["schema_validation", "empty_model_structure"].includes(result.errorType)) return false;'));
assert.ok(appSource.indexOf("ensureLongScriptTaskRoutesReady") < appSource.indexOf("busyAction = \"长剧本分析\""));
assert.ok(appSource.includes("current-selected-model"));
assert.ok(appSource.includes("providerNameForModel"));
assert.ok(appSource.includes("这是 Demo Provider 测试，不代表真实 API 可用"));
assert.ok(appSource.includes("apiKeyInput && apiKeyInput !== provider.apiKey"));
assert.ok(appSource.includes('autocomplete="new-password"'));
assert.ok(appSource.includes("commitOpenInputsBeforeAction"));
assert.ok(appSource.indexOf("const current = commitOpenInputsBeforeAction(taskLabels[taskType] || taskType);") < appSource.indexOf("busyAction = taskLabels[taskType] || taskType;"));
assert.ok(appSource.includes("analysis.sourceMeta?.blockedSave"));
assert.ok(appSource.includes("canSaveAnalysisAsCase"));
assert.ok(appSource.includes("renderAnalysisSourceAlert"));
assert.ok(appSource.includes("renderAnalysisQualityPanel"));
assert.ok(appSource.includes('state.view === "analysis"'));
assert.ok(appSource.indexOf('state.view === "analysis"') < appSource.indexOf("<h2>审计提示</h2>"));
assert.ok(appSource.includes("normalizeRelationshipEdge"));
assert.ok(appSource.includes("证据账本"));
assert.ok(appSource.includes("Beat 账本"));
assert.ok(appSource.includes("确认这是完整剧本"));
assert.ok(appSource.includes("shouldUseLongScriptAnalysis"));
assert.ok(appSource.includes("executeLongScriptAnalysis"));
assert.ok(appSource.includes("长剧本分析进度"));
assert.ok(appSource.includes("用户声明集数"));
assert.ok(appSource.includes("系统检测集数"));
assert.ok(appSource.includes("完整性来源"));
assert.ok(appSource.includes("重试失败分集"));
assert.ok(appSource.includes("重试全剧聚合"));
assert.ok(appSource.includes("当前没有失败分集可重试"));
assert.ok(appSource.includes("当前剧本文本已变化，旧分集结果可能不匹配。请重新开始长剧本分析。"));
assert.ok(appSource.includes("failureStage"));
assert.ok(appSource.includes("失败阶段："));
assert.ok(appSource.includes("分集结果已保留，可只重试全剧聚合。"));
assert.ok(appSource.includes("测试 analyzeEpisodeChunk JSON 输出"));
assert.ok(appSource.includes("分集 JSON 探针中"));
assert.ok(appSource.includes("assertProbeChunkUsable"));
assert.ok(appSource.includes("jsonFailureStreak >= 3"));
assert.ok(appSource.includes("skippedDueToJsonFailure"));
assert.ok(appSource.includes("skippedDueToProbeFailure"));
assert.ok(appSource.includes("probeFailureType"));
assert.ok(appSource.includes("schemaRepairAnalyzeEpisodeChunk"));
assert.ok(appSource.includes("成功（结构修复）"));
assert.ok(appSource.includes("passed_with_schema_repair"));
assert.ok(appSource.includes("rawTaskFailed"));
assert.ok(appSource.includes("repairTaskType: taskRepairResult?.success ? \"schemaRepairAnalyzeEpisodeChunk\""));
assert.ok(appSource.includes("通过（结构修复，需复核）"));
assert.ok(appSource.includes("原始 analyzeEpisodeChunk 输出没有遵守字段结构，系统通过 schemaRepairAnalyzeEpisodeChunk 修复为标准 EpisodeChunkAnalysis"));
assert.ok(appSource.includes("taskRouteHealthUsedSchemaRepair"));
assert.ok(appSource.includes("依赖 schema repair 才通过，长剧本结果将标记 needsReview，不能进入正式 Skill 沉淀"));
assert.ok(appSource.includes("result.success && (result.schemaRepaired || result.parsedJson?.sourceMeta?.schemaRepaired) ? \"可用但需复核\""));
assert.ok(appSource.includes("repair 后 compact schema"));
assert.ok(appSource.indexOf("shouldAttemptEpisodeSchemaRepair(taskResult)") > appSource.indexOf("let taskResult = await callModel"));
assert.ok(appSource.includes("模型返回字段："));
assert.ok(appSource.includes("系统期望字段："));
assert.ok(appSource.includes("JSON，但模型返回结构不符合 EpisodeChunkAnalysis compact schema"));
assert.ok(!appSource.includes("abortedByJsonFailure = true;\\n        abortedByJsonFailure = true"));
assert.ok(appSource.includes("连续 3 个分集返回非 JSON，已暂停长剧本分析"));
assert.ok(appSource.includes("rawOutputPreview"));
assert.ok(appSource.includes('draft.steps[3].status = aggregateSkipped || aggregateFailed ? "跳过" : "成功"'));
assert.ok(appSource.includes("chunkResults[chunkKey]"));
assert.ok(appSource.includes("Object.values(chunkResults)"));
assert.ok(appSource.includes("missingChunks"));
assert.ok(appSource.includes("仅切出"));
assert.ok(appSource.includes("applyLongScriptGateFlags"));
assert.ok(appSource.includes("参与聚合 chunk"));
assert.ok(appSource.includes("启发式标题切分，需复核分集边界"));
assert.ok(appSource.includes("该任务已按安全输出上限发送。完整剧本将使用分集分析流程，而不是依赖单次超大输出。"));
assert.ok(appSource.includes("sourceText 校验"));
assert.ok(appSource.includes("原文未命中，需复核"));
assert.ok(appSource.includes("模型返回为字符串，已自动标准化，需复核"));
assert.ok(appSource.includes("usableForCaseSave"));
assert.ok(appSource.includes("已保存为待复核案例草稿"));
assert.ok(appSource.includes("async function handleAction(payload)"));
assert.ok(!appSource.includes("const action = target.dataset.action"));
const promptBuilderSource = await fs.readFile(new URL("../src/prompt-builder.js", import.meta.url), "utf8");
const taskContractSource = await fs.readFile(new URL("../src/task-output-contracts.js", import.meta.url), "utf8");
const coverageSource = await fs.readFile(new URL("../src/script-coverage.js", import.meta.url), "utf8");
const splitterSource = await fs.readFile(new URL("../src/script-splitter.js", import.meta.url), "utf8");
const longAnalysisSource = await fs.readFile(new URL("../src/long-script-analysis.js", import.meta.url), "utf8");
const evidenceValidatorSource = await fs.readFile(new URL("../src/evidence-validator.js", import.meta.url), "utf8");
const jsonExtractorSource = await fs.readFile(new URL("../src/json-extractor.js", import.meta.url), "utf8");
const providerDiagnosticsSource = await fs.readFile(new URL("../src/provider-diagnostics.js", import.meta.url), "utf8");
const modelRouterSource = await fs.readFile(new URL("../src/model-router.js", import.meta.url), "utf8");
const modelConfigSource = await fs.readFile(new URL("../src/model-config.js", import.meta.url), "utf8");
assert.ok(providerDiagnosticsSource.includes("diagnoseProviderProtocol"));
assert.ok(providerDiagnosticsSource.includes("protocol_mismatch_openai_body_to_gemini_native"));
assert.ok(providerDiagnosticsSource.includes("suggestProviderFix"));
assert.ok(modelRouterSource.includes('candidate.health?.status !== "protocol_error"'));
assert.ok(modelConfigSource.includes("createdAt: model.createdAt || now"));
assert.ok(modelConfigSource.includes("updatedAt: model.updatedAt || model.createdAt || null"));
assert.ok(modelConfigSource.includes("updatedAt: route.updatedAt || route.createdAt || null"));
assert.ok(promptBuilderSource.includes("getTaskOutputContract"));
assert.ok(promptBuilderSource.includes("你是严格 JSON 生成器，不是聊天助手"));
assert.ok(promptBuilderSource.includes("只返回 EpisodeChunkAnalysis JSON 对象"));
assert.ok(promptBuilderSource.includes("analyzeEpisodeChunk"));
assert.ok(promptBuilderSource.includes("你正在执行 analyzeEpisodeChunk。"));
assert.ok(promptBuilderSource.includes("根对象必须直接是 EpisodeChunkAnalysis。"));
assert.ok(promptBuilderSource.includes("禁止返回 episodeAnalysis。"));
assert.ok(promptBuilderSource.includes("禁止返回 structuralAnalysis。"));
assert.ok(promptBuilderSource.includes("必须严格返回这个最小结构"));
assert.ok(promptBuilderSource.indexOf("你正在执行 analyzeEpisodeChunk。") < promptBuilderSource.indexOf("当前任务：${taskType}"));
assert.ok(taskContractSource.includes("analyzeEpisodeChunkCompact"));
assert.ok(taskContractSource.includes("禁止输出旧结构或外层包裹字段"));
assert.ok(taskContractSource.includes("episodeAnalysis"));
assert.ok(taskContractSource.includes("禁止返回 result/data/output 包裹"));
assert.ok(taskContractSource.includes("严格返回这个最小合法 EpisodeChunkAnalysis 示例结构"));
assert.ok(taskContractSource.includes("episodeFunctionAnalysis.evidenceBeatIds 必须引用 episodeBeatLedger 中真实存在的 beatId"));
assert.ok(taskContractSource.includes("schemaRepairAnalyzeEpisodeChunk"));
assert.ok(taskContractSource.includes("不得包在 scriptAnalysis"));
assert.ok(taskContractSource.includes("episodeBeatLedger"));
assert.ok(taskContractSource.includes("evidenceLedger"));
assert.ok(taskContractSource.includes("sourceText 必须来自用户输入原文"));
assert.ok(taskContractSource.includes("structureSteps"));
assert.ok(taskContractSource.includes("variableSlots"));
assert.ok(taskContractSource.includes("schemaRepairAnalyzeScript"));
assert.ok(coverageSource.includes("requiresManualFullScriptConfirmation"));
assert.ok(coverageSource.includes("fullScriptConfidence"));
assert.ok(coverageSource.includes("completenessSource"));
assert.ok(splitterSource.includes("splitScriptIntoEpisodes"));
assert.ok(splitterSource.includes("EP|Episode"));
assert.ok(splitterSource.includes("启发式分集边界"));
assert.ok(longAnalysisSource.includes("shouldUseLongScriptAnalysis"));
assert.ok(longAnalysisSource.includes("aggregateScriptAnalysis"));
assert.ok(longAnalysisSource.includes("failedChunks"));
assert.ok(longAnalysisSource.includes("missingChunks"));
assert.ok(longAnalysisSource.includes("applyLongScriptGateFlags"));
assert.ok(longAnalysisSource.includes("chunkedAnalysis"));
assert.ok(longAnalysisSource.includes("localAggregateFallback"));
assert.ok(longAnalysisSource.includes("createLongScriptInputSignature"));
assert.ok(longAnalysisSource.includes("sameLongScriptInputSignature"));
assert.ok(longAnalysisSource.includes("skippedChunks"));
assert.ok(jsonExtractorSource.includes("extractJsonCandidate"));
assert.ok(jsonExtractorSource.includes("brace_match"));
assert.ok(jsonExtractorSource.includes("fenced_json"));
assert.ok(evidenceValidatorSource.includes("validateEvidenceSourceText"));
assert.ok(evidenceValidatorSource.includes("invalidEvidenceRatio"));
assert.ok(evidenceValidatorSource.includes("missingSourceText"));
assert.ok(!evidenceValidatorSource.includes("items.filter((item) => String(item.sourceText"));
assert.ok(modelAdapterSource.includes("normalizeParsedOutputForTask"));
assert.ok(modelAdapterSource.includes("coerceAnalyzeScriptOutput"));
assert.ok(modelAdapterSource.includes("unwrapPath"));
assert.ok(modelAdapterSource.includes("blockedSave"));
assert.ok(modelAdapterSource.includes("hasAnalyzeCoreField"));
assert.ok(modelAdapterSource.includes("isWrapperPayload"));
assert.ok(modelAdapterSource.includes("usableForLearning"));
assert.ok(modelAdapterSource.includes("createDemoSchemaRepairDraft"));
assert.ok(modelAdapterSource.includes("applyEvidenceValidationToAnalysis"));
assert.ok(modelAdapterSource.includes("parseJsonWithRepair"));
assert.ok(modelAdapterSource.includes("jsonExtractionMethod"));
assert.ok(modelAdapterSource.includes("jsonRepairAttempted"));
assert.ok(modelAdapterSource.includes("rawOutputPreview"));
assert.ok(modelAdapterSource.includes("coerceEpisodeChunkOutput"));
assert.ok(modelAdapterSource.includes("模型返回非 JSON"));
assert.ok(modelAdapterSource.includes("meta.usableForLearning = meta.usableForSkillLearning"));
assert.ok(!modelAdapterSource.includes("sourceMeta.usableForLearning = !sourceMeta.blockedSave"));

console.log("check passed: V1.2 evidence-led script analysis, API safety, editable Skill assets, model routing, redaction, and docx parsing are coherent");

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
