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
import { exportOutlineMarkdown } from "../src/export.js";

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

const files = ["index.html", "server.js", "src/app.js", "src/styles.css"];
for (const file of files) {
  await fs.access(new URL(`../${file}`, import.meta.url));
}

console.log("check passed: V1 demo workflow, audit, repair, draft, and export are coherent");
