const contracts = {
  analyzeScript: `必须返回一个可直接 JSON.parse 的根对象，根对象不得包在 scriptAnalysis、analysis、result、data 或 output 内。
根对象必须直接包含以下字段：
{
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
      "patternType": "模式类型",
      "title": "模式标题",
      "description": "模式描述",
      "applicableGenres": [],
      "applicableAudienceNeeds": [],
      "structureTemplate": "结构模板",
      "whyItWorks": "为什么有效",
      "risks": [],
      "exampleEpisodes": [],
      "confidence": 0.8
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
};

export function getTaskOutputContract(taskType) {
  if (taskType === "schemaRepairAnalyzeScript") {
    return [
      "这是 analyzeScript 的结构修复任务。只允许根据原始模型输出和原剧本文本整理为标准结构，不允许编造没有依据的分析。",
      "不确定字段请填 unknown、空数组，或在 riskNotes / sourceMeta.needsManualReview 中标记需要人工复核。",
      contracts.analyzeScript
    ].join("\n\n");
  }
  return contracts[taskType] || "";
}
