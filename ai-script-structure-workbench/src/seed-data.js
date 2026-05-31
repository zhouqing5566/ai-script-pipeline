import { audienceNeedTypes, hookTypes } from "./schemas.js";
import { createSeedApiConfig } from "./model-config.js";
import { normalizeSkillList } from "./skill-manager.js";

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
    skillFilters: {
      function: "全部",
      genre: "全部",
      audience: "全部",
      status: "全部"
    },
    saveStatus: "本地已保存",
    lastExport: null,
    scriptInput: {
      title: "逆光重生：她把命运剧本撕了",
      format: "短剧",
      genre: "都市 / 重生 / 复仇",
      episodeCount: 24,
      granularity: "标准",
      userConfirmedFullScript: false,
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
    skills: normalizeSkillList(createSeedSkills()),
    apiConfig: createSeedApiConfig(),
    patternLearning: createSeedPatternLearning(),
    modelLogs: []
  };
}

function createSeedPatternLearning() {
  return {
    storyBlueprint: null,
    mechanismAnalysis: null,
    patternCards: [],
    skillAssets: [],
    newIdea: "一个被封杀的天才 AI 编剧进入短剧公司，用数据预测爆款，被所有老编剧嘲笑",
    patternTransferResult: null,
    patternTransferAudit: null,
    updatedAt: null
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
      id: "skill-global-structure-v1",
      name: "全局基础剧本结构 Skill",
      description: "所有分析、生成、审计任务都会兜底调用的基础结构规则。",
      category: "全局",
      skillType: "剧本分析 Skill",
      genreScope: [],
      audienceNeedScope: [],
      platformScope: ["短剧", "漫剧", "网文改编"],
      taskScope: ["analyzeScript", "generateMacroOutline", "generateEpisodeOutline", "auditOutline", "generateDraft"],
      priority: 20,
      status: "已启用",
      source: "system",
      version: "1.0.0",
      rules: [
        "任何输出都必须回答结构功能是什么。",
        "已锁定内容不得被后续生成擅自覆盖。",
        "情节必须服务人物、主题、关系或情绪，否则标记为弱情节。"
      ],
      positiveExamples: ["第 9 集爽点释放同时迫使主角承认自己的误判，关系也发生变化。"],
      negativeExamples: ["反派挑衅，主角打脸，众人震惊，但人物、主题、关系没有变化。"],
      promptAdditions: ["输出前检查：主题、人物、情绪、主线大反差、结尾承诺是否互相支撑。"],
      outputSchemaRef: "TaskSchema",
      evaluationCriteria: ["是否减少空泛总结", "是否明确每集存在理由", "是否保留锁定锚点"],
      riskWarnings: ["只堆爽点会造成中段疲劳。", "反转必须意外但合理。"],
      modelPreference: {
        preferredModelIds: ["model-demo-rule-engine"],
        forbiddenModelIds: [],
        requireCapabilities: ["json"],
        allowFallback: true,
        fallbackStrategy: "任务路由优先，失败后使用备用模型",
        notes: "首版默认绑定 Demo 模型，真实 API 配好后可替换。"
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "系统",
      changelog: [{ at: new Date().toISOString(), actor: "系统", summary: "创建全局基础 Skill" }]
    },
    {
      id: "skill-analysis-v1",
      name: "剧本结构分析 Skill",
      category: "按功能",
      skillType: "剧本分析 Skill",
      genreScope: ["都市", "重生", "复仇"],
      audienceNeedScope: ["尊严修复", "公平清算"],
      platformScope: ["短剧", "漫剧"],
      taskScope: ["analyzeScript", "extractPatterns", "classifyCase"],
      priority: 90,
      version: "1.0.0",
      status: "已启用",
      source: "system",
      description: "强制从情绪需求、主题、人物、主线大反差和分集功能拆解剧本。",
      rules: [
        "不只总结剧情，必须说明结构功能。",
        "每个风险字段必须指出可修复方向。",
        "每集必须拆人物功能、主题功能、信息增量和结尾悬念。"
      ],
      positiveExamples: ["开头羞辱不仅是事件，也是尊严修复情绪债和后续清算期待。"],
      negativeExamples: ["本剧讲述女主复仇成功，过程很爽。"],
      promptAdditions: ["拆解时优先回答：观众为什么继续看，结构为什么有效，哪些模式可复用。"],
      outputSchemaRef: "ScriptAnalysisRecord",
      evaluationCriteria: ["是否拆出观众情绪需求", "是否拆出主线大反差", "是否避免剧情复述"],
      riskWarnings: ["空泛总结会污染案例库。", "标签过多但无使用建议会变成垃圾标签。"],
      modelPreference: {
        preferredModelIds: ["model-demo-rule-engine"],
        forbiddenModelIds: [],
        requireCapabilities: ["json"],
        allowFallback: true,
        fallbackStrategy: "允许切到任务备用模型，但不得静默切 Demo",
        notes: "真实 API 模式建议使用长上下文、高质量 JSON 模型。"
      },
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
      category: "按功能",
      skillType: "细纲生成 Skill",
      genreScope: ["都市", "重生", "复仇"],
      audienceNeedScope: ["尊严修复", "公平清算"],
      platformScope: ["短剧", "漫剧"],
      taskScope: ["generateMacroOutline", "generateStageOutline", "generateEpisodeOutline"],
      priority: 95,
      version: "1.0.0",
      status: "已启用",
      source: "system",
      description: "基于锁定锚点生成宏观结构、阶段大纲和分集细纲。",
      rules: [
        "生成必须引用已锁定主题、大反差、结局和大节点。",
        "每集必须包含人物功能、情绪功能、主题功能、关系变化。",
        "未锁定内容生成时必须标记风险。"
      ],
      positiveExamples: ["每次反击都带来信息权、关系权或选择权变化。"],
      negativeExamples: ["连续三集只有反派挑衅和主角打脸。"],
      promptAdditions: ["分集细纲必须解释这一集为什么存在。"],
      outputSchemaRef: "EpisodeOutline",
      evaluationCriteria: ["每集是否有人物功能", "是否有信息增量", "结尾是否留期待"],
      riskWarnings: ["未锁定主题时容易写成流水账。", "连续机械打脸会导致中段疲劳。"],
      modelPreference: {
        preferredModelIds: ["model-demo-rule-engine"],
        forbiddenModelIds: [],
        requireCapabilities: ["json"],
        allowFallback: true,
        fallbackStrategy: "优先任务路由备用模型",
        notes: "真实 API 模式建议使用长上下文模型。"
      },
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
    },
    {
      id: "skill-genre-rebirth-revenge-v1",
      name: "重生复仇 Skill",
      description: "适用于重生、复仇、真相追索类项目，强调前世情绪债、今生证据链和终局清算。",
      category: "按题材",
      skillType: "重生复仇 Skill",
      genreScope: ["重生", "复仇", "都市"],
      audienceNeedScope: ["公平清算", "尊严修复", "复仇释放"],
      platformScope: ["短剧", "漫剧", "网文"],
      taskScope: ["evaluateIdea", "generateDirections", "generateMainlineReversals", "generateEpisodeOutline", "auditOutline"],
      priority: 75,
      status: "已启用",
      source: "system",
      version: "1.0.0",
      rules: [
        "前期必须建立前世亏欠和今生反击机会。",
        "复仇爽点不能只靠羞辱回敬，最好推进证据链、身份权或关系权。",
        "中段必须揭示更深真相，避免只循环清算小反派。"
      ],
      positiveExamples: ["女主没有立刻翻盘，而是留下漏洞引出真正操盘者。"],
      negativeExamples: ["主角凭前世记忆每集无成本碾压所有人。"],
      promptAdditions: ["优先规划：前世债、今生局、证据链、幕后真相、终局选择。"],
      outputSchemaRef: "EpisodeOutline",
      evaluationCriteria: ["复仇是否升级", "真相是否有伏笔", "主角是否被仇恨考验"],
      riskWarnings: ["复仇释放过早会透支后续期待。"],
      modelPreference: {
        preferredModelIds: ["model-demo-rule-engine"],
        forbiddenModelIds: [],
        requireCapabilities: ["json"],
        allowFallback: true,
        fallbackStrategy: "题材 Skill 可让位于任务路由模型",
        notes: ""
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "系统",
      changelog: [{ at: new Date().toISOString(), actor: "系统", summary: "创建重生复仇题材 Skill" }]
    },
    {
      id: "skill-format-short-drama-v1",
      name: "短剧强爽 Skill",
      description: "适用于短剧强爽节奏，强调前期高频冲突、信息清楚和集尾钩子。",
      category: "按题材",
      skillType: "短剧强爽 Skill",
      genreScope: ["短剧", "都市逆袭"],
      audienceNeedScope: ["尊严修复", "公平清算", "身份跃迁"],
      platformScope: ["短剧"],
      taskScope: ["generateDirections", "generateEpisodeOutline", "generateDraft"],
      priority: 70,
      status: "已启用",
      source: "system",
      version: "1.0.0",
      rules: [
        "前 3 集必须高频打脸或强冲突验证钩子。",
        "每集开头 10 秒给冲突、疑问或高压选择。",
        "每集结尾必须留危机、误会、反转或选择。"
      ],
      positiveExamples: ["订婚宴羞辱开局后，用证据反杀但留下幕后操盘者疑问。"],
      negativeExamples: ["连续铺垫关系不释放冲突，前 3 集没有爽点。"],
      promptAdditions: ["短剧表达必须信息清楚，冲突外化，钩子前置。"],
      outputSchemaRef: "EpisodeOutline",
      evaluationCriteria: ["开场是否够快", "每集是否有爽点", "结尾是否形成下一集期待"],
      riskWarnings: ["高频打脸可能与情感宿命、慢热铺垫类 Skill 冲突。"],
      modelPreference: {
        preferredModelIds: ["model-demo-rule-engine"],
        forbiddenModelIds: [],
        requireCapabilities: ["json"],
        allowFallback: true,
        fallbackStrategy: "允许任务模型覆盖",
        notes: ""
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "系统",
      changelog: [{ at: new Date().toISOString(), actor: "系统", summary: "创建短剧强爽 Skill" }]
    },
    {
      id: "skill-need-fairness-v1",
      name: "公平清算 Skill",
      description: "适用于公平清算情绪需求，重点设计证据、公开审判和秩序重建。",
      category: "按观众情绪需求",
      skillType: "公平清算 Skill",
      genreScope: ["都市", "复仇", "权谋"],
      audienceNeedScope: ["公平清算", "秩序重建", "尊严修复"],
      platformScope: ["短剧", "漫剧", "网文"],
      taskScope: ["analyzeScript", "generateThemeCandidates", "generateEpisodeOutline", "auditOutline"],
      priority: 68,
      status: "已启用",
      source: "system",
      version: "1.0.0",
      rules: [
        "爽点最好以证据链、公开承认或秩序修复完成。",
        "反派不能只是被打脸，还要失去操控叙事的权力。",
        "结局必须还上开头被污名化或被剥夺公平的情绪债。"
      ],
      positiveExamples: ["主角让对方在公开场合承认造假，同时修复被误解的人际关系。"],
      negativeExamples: ["主角赢了比赛，但开头被冤枉的问题没有被公开清算。"],
      promptAdditions: ["优先检查：谁欠了主角公平，如何被看见，如何被清算。"],
      outputSchemaRef: "ThemeAudit",
      evaluationCriteria: ["公平债是否明确", "清算是否公开", "秩序是否重建"],
      riskWarnings: ["如果只做私下报复，公平清算情绪兑现会不足。"],
      modelPreference: {
        preferredModelIds: ["model-demo-rule-engine"],
        forbiddenModelIds: [],
        requireCapabilities: ["json"],
        allowFallback: true,
        fallbackStrategy: "允许任务模型覆盖",
        notes: ""
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "系统",
      changelog: [{ at: new Date().toISOString(), actor: "系统", summary: "创建公平清算情绪 Skill" }]
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
