const contracts = {
  analyzeScript: `必须返回一个可直接 JSON.parse 的根对象，根对象不得包在 scriptAnalysis、analysis、result、data 或 output 内。
本任务必须先抽证据，再做判断：先生成 evidenceLedger 和 episodeBeatLedger，再基于 evidenceIds / evidenceBeatIds 输出结构分析。
不得只输出概念总结。sourceText 必须来自用户输入原文，不得编造。
每个核心模块必须包含 evidenceIds、evidenceBeatIds、inferenceLevel、confidence、riskNotes；没有证据时 needsReview=true，并将 inferenceLevel 标为“合理推断”“创作建议”或“不足以判断”。
输入不完整时，不要生成确定性的完整主线和结局；原文没有的信息必须标记“不足以判断”。
可复用模式必须包含 structureSteps、variableSlots、reusePrompt，并引用 sourceEvidenceIds 或 sourceBeatIds。
根对象必须直接包含以下字段：
{
  "coverage": {
    "inputType": "full_script | partial_script | single_episode | synopsis | outline | fragment | unknown",
    "detectedEpisodeCount": 1,
    "userEpisodeCount": 24,
    "hasEpisodeMarkers": true,
    "detectedEpisodeMarkers": ["第一集"],
    "estimatedCoverageRatio": 0.04,
    "coverageReason": "为什么这样判断输入完整度",
    "canAnalyzeOpening": true,
    "canAnalyzeFullMainline": false,
    "canAnalyzeEnding": false,
    "canAnalyzeEpisodeFunctions": true,
    "canAnalyzeReusablePatterns": true,
    "allowedCaseScope": "opening_case",
    "warnings": []
  },
  "caseScope": "full_script | opening_case | episode_case | fragment_case",
  "episodeBeatLedger": [
    {
      "beatId": "B001",
      "episodeNo": 1,
      "sceneNo": 1,
      "sourceText": "必须来自原文",
      "beatSummary": "这一 beat 发生了什么",
      "characters": [],
      "location": "场景",
      "conflict": "冲突",
      "audienceEmotion": [],
      "suspenseQuestion": "观众追问",
      "coolPoint": "爽点/期待点",
      "characterFunction": "人物功能",
      "relationshipChange": "关系变化",
      "informationGain": "信息增量",
      "structureFunction": "结构功能",
      "reusableValue": "可复用价值",
      "relatedModules": [],
      "confidence": 0.8
    }
  ],
  "evidenceLedger": {
    "coverage": {},
    "scenes": [],
    "characterMentions": [],
    "conflictBeats": [],
    "hookEvidence": [],
    "goldfingerEvidence": [],
    "suspenseEvidence": [],
    "endingEvidence": [],
    "episodeEvidence": []
  },
  "basicInfo": {
    "title": "剧本标题",
    "genre": ["题材"],
    "subGenre": ["细分题材或情绪"],
    "format": "短剧 | 漫剧 | 网文 | 互动剧 | 其他",
    "episodeCount": 24,
    "estimatedLength": "长度估计",
    "targetAudience": "目标用户",
    "platformFit": ["平台"],
    "coreAppeal": "核心看点",
    "commercialPositioning": "商业定位",
    "riskNotes": ["风险"]
  },
  "hookAnalysis": {
    "openingSummary": "开头概述",
    "hookTypes": ["钩子类型"],
    "firstSceneFunction": "首场功能",
    "firstEpisodeFunction": "首集功能",
    "conflictIntroduced": "引入冲突",
    "suspenseIntroduced": "引入悬念",
    "contrastIntroduced": "引入反差",
    "emotionalPressure": "情绪压力",
    "viewerQuestion": "观众追问",
    "whyContinueWatching": "继续观看理由",
    "hookStrengthScore": 80,
    "riskNotes": ["风险"]
  },
  "audienceNeedAnalysis": {
    "primaryNeeds": ["主要情绪需求"],
    "secondaryNeeds": ["次要情绪需求"],
    "emotionalPromise": "情绪承诺",
    "emotionalReleaseMechanism": "释放机制",
    "audiencePainPoint": "现实痛点",
    "fantasyCompensation": "幻想补偿",
    "satisfactionPath": "满足路径",
    "emotionalNeedScore": 80,
    "riskNotes": ["风险"]
  },
  "themeAnalysis": {
    "themeStatement": "主题句",
    "deepTheme": "深层主题",
    "antiThemeForce": "反主题力量",
    "themeCarrierCharacters": ["承载人物"],
    "themeConflict": "主题冲突",
    "howThemeIsExpressed": "表达方式",
    "themePayoff": "主题兑现",
    "themeStrengthScore": 80,
    "riskNotes": ["风险"]
  },
  "mainlineStructure": {
    "protagonistStartPoint": "主角起点",
    "protagonistGoal": "主角目标",
    "centralConflict": "核心冲突",
    "drivingQuestion": "驱动问题",
    "stageStructure": [
      {
        "stageNo": 1,
        "title": "阶段名",
        "episodeRange": "1-5",
        "stageGoal": "阶段目标",
        "mainConflict": "阶段冲突",
        "majorTurningPoint": "转折",
        "emotionalFunction": "情绪功能",
        "characterFunction": "人物功能",
        "endingHook": "阶段钩子"
      }
    ],
    "escalationLogic": "升级逻辑",
    "midpointChange": "中点变化",
    "finalConflict": "终局冲突",
    "mainlineStrengthScore": 80,
    "riskNotes": ["风险"]
  },
  "mainlineReversalAnalysis": {
    "hasMainlineReversal": true,
    "title": "大反差标题",
    "surfaceStory": "表层故事",
    "deepTruth": "深层真相",
    "reversalTypes": ["反差类型"],
    "revealTiming": "揭示时机",
    "foreshadowingBeforeReveal": ["伏笔"],
    "impactAfterReveal": "揭示后影响",
    "characterImpact": "人物影响",
    "themeConnection": "主题关联",
    "reversalStrengthScore": 80,
    "riskNotes": ["风险"]
  },
  "endingAnalysis": {
    "endingSummary": "结局概述",
    "protagonistFinalState": "主角终态",
    "antagonistFinalState": "反派终态",
    "relationshipFinalState": "关系终态",
    "worldFinalState": "世界终态",
    "themePayoff": "主题兑现",
    "emotionalPayoff": "情绪兑现",
    "promisedEmotionReturned": true,
    "unresolvedIssues": [],
    "endingStrengthScore": 80,
    "riskNotes": ["风险"]
  },
  "characterAnalysis": {
    "protagonist": {
      "name": "姓名",
      "role": "角色",
      "archetype": "原型",
      "surfaceDesire": "表层欲望",
      "innerLack": "内在缺失",
      "misbelief": "误判",
      "fear": "恐惧",
      "wound": "伤口",
      "temptation": "诱惑",
      "mask": "面具",
      "motivation": "动机",
      "conflictWithProtagonist": "冲突",
      "relationshipToTheme": "主题关系",
      "relationshipToMainlineReversal": "大反差关系",
      "turningPoints": ["转折"],
      "finalChoice": "最终选择",
      "arcSummary": "弧光",
      "riskNotes": ["风险"]
    },
    "mainCharacters": [],
    "relationshipEdges": [],
    "characterSystemSummary": "人物系统总结",
    "characterStrengthScore": 80,
    "riskNotes": ["风险"]
  },
  "goldfingerAnalysis": {
    "hasGoldfinger": false,
    "name": "金手指名",
    "type": "类型",
    "visibleFunction": "显性功能",
    "hiddenNature": "隐藏本质",
    "rules": [],
    "limits": [],
    "costs": [],
    "upgradePath": [],
    "coolUses": [],
    "misuseRisks": [],
    "relationshipToTheme": "主题关系",
    "relationshipToCharacterArc": "人物关系",
    "goldfingerStrengthScore": 70,
    "riskNotes": []
  },
  "obstacleAnalysis": {
    "obstacleTypes": [],
    "obstacleEscalation": "阻碍升级",
    "antagonistSystem": "反派系统",
    "whyCannotBeSolvedAtOnce": "为何不能一次解决",
    "pressureMechanism": "压力机制",
    "obstacleStrengthScore": 70,
    "riskNotes": []
  },
  "episodeFunctionAnalysis": [
    {
      "episodeNo": 1,
      "title": "集标题",
      "summary": "本集摘要",
      "openingHook": "开头钩子",
      "episodeGoal": "本集目标",
      "mainConflict": "核心冲突",
      "keyEvent": "关键事件",
      "coolMoment": "爽点",
      "emotionalBeat": "情绪点",
      "informationGain": "信息增量",
      "characterFunction": "人物功能",
      "relationshipChange": "关系变化",
      "themeFunction": "主题功能",
      "foreshadowingPlanted": [],
      "foreshadowingUsed": [],
      "cliffhanger": "结尾悬念",
      "episodeFunctionType": [],
      "weaknessNotes": [],
      "score": 80
    }
  ],
  "reusablePatterns": [
    {
      "id": "pattern-1",
      "sourceScriptId": "current-analysis",
      "patternType": "hook | coolMoment | reversal | characterRelation | goldfingerUse | episodeRhythm | mainlineSkeleton | endingPayoff",
      "title": "模式标题",
      "description": "模式描述",
      "sourceEvidenceIds": [],
      "sourceBeatIds": [],
      "applicableGenres": [],
      "applicableAudienceNeeds": [],
      "structureSteps": ["结构步骤"],
      "variableSlots": {"scene": ["变量候选"]},
      "whyItWorks": "为什么有效",
      "emotionalMechanism": "情绪机制",
      "characterFunction": "人物功能",
      "plotFunction": "剧情功能",
      "risks": [],
      "antiPatterns": [],
      "reusePrompt": "如何复用该模式",
      "exampleEpisodes": [],
      "confidence": 0.8,
      "inferenceLevel": "原文明确 | 合理推断 | 创作建议 | 不足以判断"
    }
  ],
  "classificationTags": {
    "genre": [],
    "audienceNeeds": [],
    "hookTypes": [],
    "goldfingerTypes": [],
    "mainlineReversalTypes": [],
    "rhythmTypes": []
  },
  "qualityNotes": {
    "strengths": [],
    "weaknesses": [],
    "suggestedRepairs": []
  },
  "analystNotes": "分析说明",
  "confidence": 0.8
}
如果无法确认某项，请填空字符串、空数组或风险说明，但不要省略字段。`
  ,
  analyzeEpisodeChunk: `必须返回一个可直接 JSON.parse 的 EpisodeChunkAnalysis 根对象，不得包在 result/data/output 内。
只分析当前 episodeText，不推断后续全剧结局，不补写未输入集数。
所有 sourceText 必须来自当前集文本，不得编造。
本集分集功能、开头钩子、结尾悬念必须引用 episodeBeatLedger 的 beatIds。
可复用模式必须引用本集 sourceEvidenceIds 或 sourceBeatIds。
根对象结构：
{
  "episodeNo": 1,
  "title": "本集标题",
  "coverage": {},
  "evidenceLedger": {
    "coverage": {},
    "scenes": [],
    "characterMentions": [],
    "conflictBeats": [],
    "hookEvidence": [],
    "goldfingerEvidence": [],
    "suspenseEvidence": [],
    "endingEvidence": [],
    "episodeEvidence": []
  },
  "episodeBeatLedger": [
    {
      "beatId": "B001",
      "episodeNo": 1,
      "sceneNo": 1,
      "sourceText": "必须来自当前集原文",
      "beatSummary": "这一 beat 发生了什么",
      "characters": [],
      "audienceEmotion": [],
      "suspenseQuestion": "观众追问",
      "structureFunction": "结构功能",
      "reusableValue": "可复用价值",
      "relatedModules": [],
      "confidence": 0.8
    }
  ],
  "episodeFunctionAnalysis": {
    "episodeNo": 1,
    "title": "集标题",
    "summary": "本集摘要",
    "openingHook": "开头钩子",
    "episodeGoal": "本集目标",
    "mainConflict": "核心冲突",
    "keyEvent": "关键事件",
    "coolMoment": "爽点",
    "emotionalBeat": "情绪点",
    "informationGain": "信息增量",
    "characterFunction": "人物功能",
    "relationshipChange": "关系变化",
    "themeFunction": "主题功能",
    "foreshadowingPlanted": [],
    "foreshadowingUsed": [],
    "cliffhanger": "结尾悬念",
    "episodeFunctionType": [],
    "weaknessNotes": [],
    "score": 80,
    "evidenceIds": [],
    "evidenceBeatIds": [],
    "inferenceLevel": "原文明确 | 合理推断 | 创作建议 | 不足以判断",
    "confidence": 0.8,
    "riskNotes": []
  },
  "hookAnalysis": {},
  "characterMentions": [],
  "goldfingerEvidence": [],
  "suspenseEvidence": [],
  "reusablePatterns": [],
  "openQuestions": [],
  "continuityNotes": [],
  "confidence": 0.8,
  "needsReview": false
}`,
  analyzeEpisodeChunkCompact: `必须返回一个可直接 JSON.parse 的 EpisodeChunkAnalysis 根对象。只返回 JSON，不要解释。
只分析当前 episodeText，不推断后续全剧结局，不补写未输入集数。
所有 sourceText 必须来自当前集文本，不得编造。
长剧本分集默认使用 compact 合同，coverage / characterMentions / goldfingerEvidence / suspenseEvidence 可由本地 normalize 补齐。
禁止输出旧结构或外层包裹字段：episodeAnalysis、structuralAnalysis、narrativeAnalysis、result、data、output。
禁止把结果包在数组里。根对象必须直接是 EpisodeChunkAnalysis。
必须输出字段名：episodeNo、title、evidenceLedger、episodeBeatLedger、episodeFunctionAnalysis、reusablePatterns、openQuestions、continuityNotes、confidence、needsReview。
根对象结构：
{
  "episodeNo": 1,
  "title": "第一集",
  "evidenceLedger": {
    "hookEvidence": [
      {
        "id": "E001",
        "sourceText": "必须来自当前集原文",
        "summary": "证据摘要",
        "evidenceType": "hook",
        "relatedBeatIds": ["B001"],
        "confidence": 0.8
      }
    ],
    "conflictBeats": [],
    "suspenseEvidence": [],
    "episodeEvidence": []
  },
  "episodeBeatLedger": [
    {
      "beatId": "B001",
      "episodeNo": 1,
      "sourceText": "必须来自当前集原文",
      "beatSummary": "",
      "characters": [],
      "audienceEmotion": [],
      "suspenseQuestion": "",
      "structureFunction": "",
      "confidence": 0.8
    }
  ],
  "episodeFunctionAnalysis": {
    "episodeNo": 1,
    "summary": "",
    "openingHook": "",
    "mainConflict": "",
    "coolMoment": "",
    "informationGain": "",
    "characterFunction": "",
    "cliffhanger": "",
    "evidenceBeatIds": ["B001"],
    "inferenceLevel": "原文明确",
    "confidence": 0.8,
    "riskNotes": []
  },
  "reusablePatterns": [],
  "openQuestions": [],
  "continuityNotes": [],
  "confidence": 0.8,
  "needsReview": false
}`,
  aggregateScriptAnalysis: `必须返回标准 analyzeScript 根对象。
只基于 episodeChunkAnalyses 的 evidenceLedger、episodeBeatLedger、episodeFunctionAnalysis 做聚合。
不要重新编造原文证据；全剧主题/主线/人物/结局必须引用已有 evidenceIds / beatIds。
如果 failedChunks 不为空，必须在 sourceMeta.failedChunks 中保留，sourceMeta.needsReview=true，usableForSkillLearning=false。
如果后段集数缺失，不得输出确定性结局，也不得把 endingAnalysis.inferenceLevel 标为“原文明确”。
输出结构与 analyzeScript 完全一致，并额外包含 sourceMeta.chunkedAnalysis=true、sourceMeta.chunkCount、sourceMeta.failedChunks。`,
  mergeEvidenceLedAnalysis: `合并 evidence-led 分析结果，要求与 aggregateScriptAnalysis 相同。`
};

export function getTaskOutputContract(taskType, options = {}) {
  if ((taskType === "analyzeEpisodeChunk" || taskType === "analyzeScriptChunk") && options.compact) return contracts.analyzeEpisodeChunkCompact;
  if (taskType === "analyzeScriptChunk") return contracts.analyzeEpisodeChunk;
  if (taskType === "mergeEvidenceLedAnalysis") return contracts.aggregateScriptAnalysis;
  if (taskType === "schemaRepairAnalyzeScript") {
    return [
      "这是 analyzeScript 的结构修复任务。只允许根据原始模型输出和原剧本文本整理为标准结构，不允许编造没有依据的分析。",
      "不确定字段请填 unknown、空数组，或在 riskNotes / sourceMeta.needsManualReview 中标记需要人工复核。",
      contracts.analyzeScript
    ].join("\n\n");
  }
  if (taskType === "schemaRepairAnalyzeEpisodeChunk") {
    return [
      "这是 analyzeEpisodeChunk 的 schema repair 任务。只允许基于 episodeText 和 rawModelJson 修复结构，不允许补写原文之外的 sourceText。",
      "禁止返回 episodeAnalysis、structuralAnalysis、narrativeAnalysis、result、data、output；根对象必须直接是 EpisodeChunkAnalysis。",
      "sourceText 必须来自 episodeText；episodeFunctionAnalysis.evidenceBeatIds 必须引用 episodeBeatLedger 中的 beatId。",
      contracts.analyzeEpisodeChunkCompact
    ].join("\n\n");
  }
  return contracts[taskType] || "";
}
