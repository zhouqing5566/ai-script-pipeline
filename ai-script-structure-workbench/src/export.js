import { labelForKey } from "./schemas.js";
import { redactApiConfig, sanitizeForExport } from "./redaction.js";

function line(value, fallback = "未填写") {
  if (Array.isArray(value)) return value.length ? value.join("、") : fallback;
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function section(title, body) {
  return `\n## ${title}\n\n${body}\n`;
}

function bulletList(items = []) {
  if (!items?.length) return "- 暂无";
  return items.map((item) => `- ${line(item)}`).join("\n");
}

export function exportProjectJson(state) {
  const safeState = sanitizeForExport(state);
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      product: "AI 剧本结构学习与细纲生产系统",
      mode: safeState.mode,
      currentProject: safeState.currentProject,
      cases: safeState.cases,
      assets: safeState.assets,
      skills: safeState.skills,
      apiConfig: redactApiConfig(safeState.apiConfig),
      modelLogs: safeState.modelLogs
    },
    null,
    2
  );
}

export function exportAnalysisMarkdown(analysis) {
  if (!analysis) return "# 剧本结构分析报告\n\n暂无分析结果。\n";
  const parts = [`# 剧本结构分析报告：${analysis.title}`];
  parts.push(
    section(
      "基础信息",
      [
        `- 题材：${line(analysis.basicInfo.genre)}`,
        `- 形式：${line(analysis.basicInfo.format)}`,
        `- 集数：${line(analysis.basicInfo.episodeCount)}`,
        `- 核心看点：${line(analysis.basicInfo.coreAppeal)}`,
        `- 商业定位：${line(analysis.basicInfo.commercialPositioning)}`
      ].join("\n")
    )
  );
  parts.push(
    section(
      "开头钩子",
      [
        `- 钩子类型：${line(analysis.hookAnalysis.hookTypes)}`,
        `- 第一场功能：${analysis.hookAnalysis.firstSceneFunction}`,
        `- 观众追看问题：${analysis.hookAnalysis.viewerQuestion}`,
        `- 强度评分：${analysis.hookAnalysis.hookStrengthScore}`,
        `- 风险：${line(analysis.hookAnalysis.riskNotes)}`
      ].join("\n")
    )
  );
  parts.push(
    section(
      "观众情绪需求",
      [
        `- 主要需求：${line(analysis.audienceNeedAnalysis.primaryNeeds)}`,
        `- 情绪承诺：${analysis.audienceNeedAnalysis.emotionalPromise}`,
        `- 现实缺口：${analysis.audienceNeedAnalysis.audiencePainPoint}`,
        `- 补偿路径：${analysis.audienceNeedAnalysis.satisfactionPath}`
      ].join("\n")
    )
  );
  parts.push(
    section(
      "主题",
      [
        `- 主题句：${analysis.themeAnalysis.themeStatement}`,
        `- 深层主题：${analysis.themeAnalysis.deepTheme}`,
        `- 反主题力量：${analysis.themeAnalysis.antiThemeForce}`,
        `- 主题兑现：${analysis.themeAnalysis.themePayoff}`
      ].join("\n")
    )
  );
  parts.push(
    section(
      "主线大反差",
      [
        `- 标题：${analysis.mainlineReversalAnalysis.title}`,
        `- 表层故事：${analysis.mainlineReversalAnalysis.surfaceStory}`,
        `- 深层真相：${analysis.mainlineReversalAnalysis.deepTruth}`,
        `- 伏笔：${line(analysis.mainlineReversalAnalysis.foreshadowingBeforeReveal)}`,
        `- 主题连接：${analysis.mainlineReversalAnalysis.themeConnection}`
      ].join("\n")
    )
  );
  parts.push(
    section(
      "分集功能表",
      analysis.episodeFunctionAnalysis
        .map(
          (episode) =>
            `### 第 ${episode.episodeNo} 集：${episode.title}\n- 开头钩子：${episode.openingHook}\n- 本集目标：${episode.episodeGoal}\n- 核心冲突：${episode.mainConflict}\n- 人物功能：${episode.characterFunction}\n- 主题功能：${episode.themeFunction}\n- 关系变化：${episode.relationshipChange}\n- 结尾悬念：${episode.cliffhanger}\n- 弱点：${line(episode.weaknessNotes, "暂无")}`
        )
        .join("\n\n")
    )
  );
  parts.push(
    section(
      "可复用模式",
      analysis.reusablePatterns
        .map((pattern) => `### ${pattern.title}\n- 类型：${pattern.patternType}\n- 为什么有效：${pattern.whyItWorks}\n- 使用风险：${line(pattern.risks)}`)
        .join("\n\n")
    )
  );
  return `${parts.join("\n")}\n`;
}

export function exportOutlineMarkdown(project) {
  const parts = [`# 分集细纲：${project.title}`];
  parts.push(
    section(
      "项目锚点",
      [
        `- 原始创意：${line(project.creativeInput)}`,
        `- 锁定主题：${line(project.lockedTheme?.themeStatement)}`,
        `- 锁定主线大反差：${line(project.lockedMainlineReversal?.title)}`,
        `- 锁定结局：${line(project.lockedEnding?.title)}`,
        `- 集数：${line(project.creativeConstraints.episodeCount)}`
      ].join("\n")
    )
  );
  if (project.macroOutline) {
    parts.push(
      section(
        "宏观结构",
        [
          `- 一句话梗概：${project.macroOutline.logline}`,
          `- 主题句：${project.macroOutline.themeStatement}`,
          `- 主线大反差：${project.macroOutline.mainlineReversal}`,
          `- 结局：${project.macroOutline.ending}`,
          `- 人物弧光：${project.macroOutline.protagonistArc}`
        ].join("\n")
      )
    );
  }
  parts.push(
    section(
      "阶段大纲",
      (project.stageOutline || [])
        .map(
          (stage) =>
            `### 第 ${stage.stageNo} 阶段：${stage.title}\n- 集数范围：${stage.episodeRange}\n- 阶段目标：${stage.stageGoal}\n- 主要冲突：${stage.majorConflict}\n- 反差进度：${stage.reversalProgress}\n- 人物推进：${stage.characterProgress}\n- 结尾钩子：${stage.endingHook}`
        )
        .join("\n\n") || "暂无"
    )
  );
  parts.push(
    section(
      "分集细纲",
      (project.episodeOutline || [])
        .map((episode) => {
          const fields = [
            "openingHook",
            "episodeGoal",
            "conflict",
            "keyEvent",
            "goldfingerUse",
            "coolMoment",
            "emotionalBeat",
            "cliffhanger",
            "characterFunction",
            "audienceNeedServed",
            "themeFunction",
            "relationshipChange",
            "informationGain",
            "foreshadowingUsed",
            "foreshadowingPlanted",
            "continuityNotes",
            "risks"
          ];
          return `### ${episode.title}\n${fields.map((key) => `- ${labelForKey(key)}：${line(episode[key])}`).join("\n")}`;
        })
        .join("\n\n") || "暂无"
    )
  );
  if (project.auditReport) {
    parts.push(exportAuditMarkdown(project.auditReport, false));
  }
  return `${parts.join("\n")}\n`;
}

export function exportCharactersMarkdown(project) {
  const core = project.macroOutline?.characterCore;
  if (!core) return "# 人物小传\n\n暂无人物核心。\n";
  const characters = [core.protagonist, ...(core.mainCharacters || [])];
  return `# 人物小传：${project.title}\n\n${characters
    .map(
      (character) =>
        `## ${character.name}（${character.role}）\n\n- 表层欲望：${character.surfaceDesire}\n- 真正缺失：${character.innerLack}\n- 最大误判：${character.misbelief}\n- 恐惧：${character.fear}\n- 伤口：${character.wound}\n- 诱惑：${character.temptation}\n- 主题关系：${character.relationshipToTheme}\n- 大反差关系：${character.relationshipToReversal}\n- 转折点：${line(character.turningPoints)}\n- 最终选择：${character.finalChoice}\n- 弧光总结：${character.arcSummary}`
    )
    .join("\n\n")}\n`;
}

export function exportAuditMarkdown(audit, withTitle = true) {
  if (!audit) return "# 审计报告\n\n暂无审计结果。\n";
  const content = [
    withTitle ? `# 审计报告\n` : "## 审计报告\n",
    `- 总分：${audit.overallScore}`,
    `- 总结：${audit.summary}`,
    "",
    "## 弱集问题",
    audit.episodeAudit.episodeIssues.length
      ? audit.episodeAudit.episodeIssues
          .map(
            (issue) =>
              `- 第 ${issue.episodeNo} 集｜${issue.issueType}｜${issue.severity}：${issue.description} 建议：${issue.suggestion}`
          )
          .join("\n")
      : "- 暂无",
    "",
    "## 修复建议",
    bulletList(audit.suggestions)
  ];
  return content.join("\n");
}

export function exportDraftMarkdown(project) {
  const drafts = project.draftEpisodes || [];
  if (!drafts.length) return "# 成稿\n\n暂无成稿。\n";
  return `# 成稿：${project.title}\n\n${drafts
    .map(
      (draft) =>
        `## ${draft.title}\n\n${draft.sceneList
          .map(
            (scene) =>
              `### 场 ${scene.sceneNo}｜${scene.location}｜${scene.time}\n\n人物：${line(scene.characters)}\n\n动作：${scene.actionDescription}\n\n${scene.dialogue
                .map((dialogue) => `**${dialogue.character}**（${dialogue.tone}）：${dialogue.line}\n\n> 潜台词：${dialogue.subtext}`)
                .join("\n\n")}\n\n视觉：${scene.visualNotes}\n\n情绪节拍：${scene.emotionalBeat}\n\n转场：${scene.transition}`
          )
          .join("\n\n")}\n\n台词风格：${draft.dialogueStyleNotes}\n\n节奏说明：${draft.pacingNotes}`
    )
    .join("\n\n")}\n`;
}
