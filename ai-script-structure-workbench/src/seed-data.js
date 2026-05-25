import { audienceNeedTypes, hookTypes } from "./schemas.js";

export function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSeedState() {
  const projectId = uid("project");
  return {
    appVersion: "V1 Demo",
    mode: "demo",
    view: "home",
    activeAnalysisTab: "overview",
    activeAssetCategory: "audienceNeeds",
    selectedEpisodeNo: 1,
    selectedSkillId: "skill-analysis-v1",
    saveStatus: "本地已保存",
    lastExport: null,
    scriptInput: {
      title: "逆光重生：她把命运剧本撕了",
      format: "短剧",
      genre: "都市 / 重生 / 复仇",
      episodeCount: 24,
      granularity: "标准",
      text: sampleScriptText()
    },
    currentProject: {
      id: projectId,
      title: "逆光重生：她把命运剧本撕了",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "创意阶段",
      creativeInput:
        "女主前世被继妹和未婚夫联手夺走家产、名誉和生命。重生回到订婚宴当晚，她意外获得能看见每个人隐藏欲望的能力，但能力每次使用都会暴露自己的一个秘密。她要在不再被仇恨吞没的前提下，夺回主动权，并揭开母亲死亡真相。",
      referenceCaseIds: ["case-seed-1"],
      selectedAssetIds: ["need-dignity", "hook-betrayal", "reversal-love-truth"],
      ideaEvaluation: null,
      directionCandidates: [],
      selectedDirection: null,
      themeCandidates: [],
      lockedTheme: null,
      mainlineReversalCandidates: [],
      lockedMainlineReversal: null,
      endingCandidates: [],
      lockedEnding: null,
      majorNodeCandidates: [],
      lockedMajorNodes: null,
      creativeConstraints: {
        format: "短剧",
        episodeCount: 24,
        stageCount: 5,
        targetAudience: "女性向短剧用户",
        tone: "强爽、强情绪、带悬疑反转",
        platformFit: "信息清楚、开场快、每集结尾强钩子"
      },
      locks: {
        direction: false,
        theme: false,
        reversal: false,
        ending: false,
        majorNodes: false,
        characterCore: false,
        goldfinger: false,
        storyEngine: false,
        stageOutline: false,
        episodeOutline: false,
        draft: false
      },
      macroOutline: null,
      stageOutline: [],
      episodeOutline: [],
      draftEpisodes: [],
      auditReport: null,
      repairs: [],
      feedback: [],
      freezeSnapshots: [],
      versions: [
        {
          id: uid("version"),
          versionNo: "v0.1",
          targetType: "project",
          targetId: projectId,
          action: "generate",
          changeSummary: "创建 Demo 项目与初始创意",
          createdAt: new Date().toISOString(),
          createdBy: "系统"
        }
      ]
    },
    cases: [
      {
        id: "case-seed-1",
        title: "重生后我让假千金付出代价",
        genre: ["都市", "重生", "复仇"],
        audienceNeeds: ["尊严修复", "公平清算", "被误解后的证明"],
        hookTypes: ["退婚/背叛开局", "身份错位开局"],
        goldfingerTypes: ["重生记忆", "剧情记忆"],
        mainlineReversalTypes: ["爱情真相反差", "敌人立场反差"],
        episodeCount: 36,
        qualityScore: 86,
        createdAt: new Date().toISOString(),
        tags: ["高情绪", "强开局", "中段揭示"],
        status: "已确认",
        summary:
          "开局用订婚宴羞辱和身份错位建立尊严修复承诺，中段揭开母亲死亡真相，终局用公开选择完成主题兑现。"
      }
    ],
    assets: createSeedAssets(),
    skills: createSeedSkills(),
    modelLogs: []
  };
}

function createSeedAssets() {
  return {
    audienceNeeds: [
      {
        id: "need-dignity",
        name: "尊严修复",
        description: "主角从被轻视、被污名化到被看见、被承认、被仰望。",
        audiencePainPoint: "被误解、被低估、被贴标签后无处辩解。",
        fantasyCompensation: "用事实和行动完成公开证明，让压迫者失去叙事权。",
        commonGenres: ["都市", "豪门", "重生", "逆袭"],
        commonHooks: ["羞辱开局", "退婚/背叛开局", "身份错位开局"],
        commonGoldfingers: ["重生记忆", "隐藏身份", "好感度面板"],
        commonPlotPatterns: ["先被定罪，再反证真相", "低位入局，高位清算"],
        commonRisks: ["只打脸不推进人物会疲劳", "反派过蠢会削弱爽感"],
        representativeCases: ["case-seed-1"],
        usageGuidance: "每次爽点最好带来身份、关系或信息权的变化。"
      },
      {
        id: "need-control",
        name: "失控后的重新掌控",
        description: "主角从被命运和他人操控，到逐步夺回选择权。",
        audiencePainPoint: "现实中被规则、家庭或关系推着走。",
        fantasyCompensation: "主角看清规则、改写规则，最终不再被系统或仇恨定义。",
        commonGenres: ["系统", "重生", "悬疑", "甜虐"],
        commonHooks: ["系统觉醒开局", "命运倒计时开局"],
        commonGoldfingers: ["系统", "预知", "死亡回档"],
        commonPlotPatterns: ["能力带来控制感，同时暴露代价", "越掌控越发现真相更大"],
        commonRisks: ["金手指失控会让冲突消失"],
        representativeCases: [],
        usageGuidance: "让金手指既是爽感工具，也是人物考验。"
      }
    ],
    hooks: [
      {
        id: "hook-betrayal",
        name: "退婚羞辱反杀",
        hookType: "退婚/背叛开局",
        description: "在公开场合让主角遭遇背叛、误判或身份羞辱，立刻建立情绪债。",
        applicableGenres: ["都市", "豪门", "重生", "甜虐"],
        applicableAudienceNeeds: ["尊严修复", "公平清算"],
        openingTemplate: "订婚宴 / 家族会议 / 发布会中，主角被最亲近的人公开定罪。",
        firstMinuteGoal: "让观众立刻知道谁亏欠主角，主角有什么反击机会。",
        whyItWorks: "公开羞辱天然制造观看压力和清算期待。",
        risks: ["羞辱过重但反击太晚会劝退", "证据链太轻会显得强行"],
        representativeCases: ["case-seed-1"],
        variationIdeas: ["主角主动让对方以为自己赢了", "看似退婚实为设局取证"]
      }
    ],
    mainlineSkeletons: [
      {
        id: "skeleton-revenge-truth",
        title: "复仇清算转真相追索",
        genreFit: ["都市", "重生", "复仇"],
        audienceNeedFit: ["尊严修复", "公平清算", "秩序重建"],
        skeletonSummary: "前期清算个人仇人，中段发现仇人只是表层，后期转向母题真相和秩序重建。",
        stageTemplate: [
          { stageNo: 1, stageName: "开局反证", function: "建立情绪债与能力规则" },
          { stageNo: 2, stageName: "借势破局", function: "用小胜换取入局资格" },
          { stageNo: 3, stageName: "真相显影", function: "大反差开始改变目标" },
          { stageNo: 4, stageName: "目标重构", function: "复仇升级为选择权争夺" },
          { stageNo: 5, stageName: "终局清算", function: "兑现主题和情绪承诺" }
        ],
        protagonistArcFit: "从只想报复，到学会不让仇恨继续操控自己。",
        commonGoldfingerFit: ["重生记忆", "好感度面板", "隐藏身份"],
        commonReversalFit: ["敌人立场反差", "爱情真相反差"],
        risks: ["中段真相如果缺伏笔，会像临时加戏"],
        representativeCases: ["case-seed-1"]
      }
    ],
    mainlineReversals: [
      {
        id: "reversal-love-truth",
        title: "表面背叛者其实在阻止更大献祭",
        reversalType: "爱情真相反差",
        surfaceExpectation: "男主是前世害死女主的人之一。",
        deepTruthTemplate: "男主前世的冷酷行为，是为了切断幕后者对女主命运的锁定。",
        applicableGenres: ["重生", "甜虐", "悬疑"],
        applicableAudienceNeeds: ["被误解后的证明", "命运反抗"],
        requiredForeshadowing: ["男主多次阻止女主使用能力", "前世死亡现场有第三方痕迹"],
        revealTimingGuidance: "在 60%-70% 剧情处给第一次可信揭示，终局前给完整真相。",
        impactOnCharacter: "女主从单一复仇转向重新判断他人选择。",
        impactOnEnding: "结局从清算仇人升级为共同破除命运规则。",
        risks: ["洗白过快会伤害前期爽感"],
        representativeCases: []
      }
    ],
    goldfingers: [
      {
        id: "goldfinger-desire",
        name: "隐藏欲望视窗",
        type: "好感度面板",
        visibleFunction: "看见他人当前最强欲望和恐惧。",
        hiddenNature: "能力会用主角秘密作为代价，迫使她面对真实自我。",
        rules: ["只能看到强烈情绪", "不能直接看到完整事实"],
        limits: ["连续使用会产生误读", "对愿意坦诚的人信息最少"],
        costs: ["暴露主角一个秘密", "削弱她对亲密关系的信任"],
        usageGuidance: "每次使用既带来爽点，也带来新的风险。"
      }
    ],
    relationships: [
      {
        id: "rel-hidden-ally",
        name: "表面敌对的隐性同盟",
        description: "一段关系先承担误解和压迫，后期反转为共同对抗命运规则。",
        risks: ["前期伤害必须有边界，否则后期难以接受。"]
      }
    ],
    rhythms: [
      {
        id: "rhythm-short-drama-24",
        title: "24 集强钩子短剧节奏",
        applicableFormat: ["短剧", "漫剧"],
        episodeLengthFit: "1-3 分钟",
        rhythmRule: "每集开头给冲突或问题，每集至少一个信息增量，每 4 集一次关系或真相升级。",
        microStructure: ["开场钩子", "冲突推进", "爽点或揭示", "结尾悬念"],
        escalationFrequency: "每 3-5 集一次中型反转，每 10-12 集一次主线升级。",
        cliffhangerMethods: ["证据反转", "身份暴露", "关系误判", "倒计时选择"],
        risks: ["连续机械打脸会导致中段疲劳。"],
        representativeCases: ["case-seed-1"]
      }
    ],
    endings: [
      {
        id: "ending-choice",
        title: "放弃控制，夺回选择",
        description: "主角不再用能力操控所有人，而是公开真相并让关键人物完成自由选择。",
        emotionalPayoff: "尊严修复、秩序重建、被误解后的证明。",
        risks: ["结局必须还上开头羞辱和中段真相两条债。"]
      }
    ]
  };
}

function createSeedSkills() {
  return [
    {
      id: "skill-analysis-v1",
      name: "剧本结构分析 Skill",
      type: "剧本分析 Skill",
      version: "1.0.0",
      status: "已启用",
      description: "强制从情绪需求、主题、人物、主线大反差和分集功能拆解剧本。",
      rules: [
        "不只总结剧情，必须说明结构功能。",
        "每个风险字段必须指出可修复方向。",
        "每集必须拆人物功能、主题功能、信息增量和结尾悬念。"
      ],
      promptTemplate: "你是专业短剧、漫剧、爽剧、网文改编方向的剧本结构顾问。",
      schemaRef: "ScriptAnalysisRecord",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "系统",
      updateReason: "V1 初始规则",
      basedOnCases: ["case-seed-1"],
      expectedImprovement: "减少空泛总结，提高可复用模式提取能力。",
      knownRisks: ["Demo 规则不能代替真实模型判断"],
      testResults: [],
      rollbackTarget: null,
      changelog: [
        {
          at: new Date().toISOString(),
          summary: "创建初版分析规则",
          passed: true
        }
      ]
    },
    {
      id: "skill-outline-v1",
      name: "分集细纲生成 Skill",
      type: "细纲生成 Skill",
      version: "1.0.0",
      status: "已启用",
      description: "基于锁定锚点生成宏观结构、阶段大纲和分集细纲。",
      rules: [
        "生成必须引用已锁定主题、大反差、结局和大节点。",
        "每集必须包含人物功能、情绪功能、主题功能、关系变化。",
        "未锁定内容生成时必须标记风险。"
      ],
      promptTemplate: "严格尊重用户已锁定的创作锚点，不得擅自覆盖。",
      schemaRef: "EpisodeOutline",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "系统",
      updateReason: "V1 初始规则",
      basedOnCases: ["case-seed-1"],
      expectedImprovement: "降低跑偏风险，避免流水账分集。",
      knownRisks: ["如果用户未锁定锚点，生成稳定性会下降"],
      testResults: [],
      rollbackTarget: null,
      changelog: [
        {
          at: new Date().toISOString(),
          summary: "创建初版细纲规则",
          passed: true
        }
      ]
    }
  ];
}

function sampleScriptText() {
  return `第1集：订婚宴上，林照被未婚夫和继妹公开指控偷走公司机密。所有宾客都在等她低头道歉，她却忽然看见继妹头顶浮现“害怕录音曝光”的欲望字样。

第2集：林照假装崩溃离场，反手让宴会大屏播放被剪辑过的证据。她没有直接翻盘，而是故意留下一个漏洞，引出真正操盘的人。

第3集：继妹逼父亲断绝关系，林照用前世记忆避开陷阱，却发现每次使用能力都会让自己的秘密被某个人听见。

第4集：男主沈砚阻止她继续追查，表面冷酷地说她会害死所有人。林照认定他也是前世共犯。

第5集：林照夺回母亲旧项目，第一次公开证明自己的能力。结尾，她发现母亲死亡现场照片里有沈砚留下的血迹。`;
}

export const seedReference = {
  audienceNeedTypes,
  hookTypes
};
