function stableId(prefix, value = "") {
  return `${prefix}-${String(value || "seed")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28) || "asset"}`;
}

function arrayOf(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined && item !== "");
  if (value === null || value === undefined || value === "") return [];
  return [value];
}

function textOf(value, fallback = "") {
  if (typeof value === "string") return value.trim() || fallback;
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function firstText(...values) {
  for (const value of values) {
    const text = textOf(value);
    if (text) return text;
  }
  return "";
}

function collectSourceEvidence(analysis = {}, limit = 8) {
  const ledger = analysis.evidenceLedger || {};
  const beats = Array.isArray(analysis.episodeBeatLedger) ? analysis.episodeBeatLedger : [];
  const evidenceGroups = [
    ...(ledger.hookEvidence || []),
    ...(ledger.conflictBeats || []),
    ...(ledger.goldfingerEvidence || []),
    ...(ledger.suspenseEvidence || []),
    ...(ledger.characterMentions || []),
    ...(ledger.endingEvidence || [])
  ];
  const evidence = evidenceGroups
    .map((item, index) => normalizeEvidenceRef(item, index))
    .filter((item) => item.sourceText || item.evidenceId || item.beatId);
  const beatRefs = beats
    .map((beat, index) => ({
      evidenceId: beat.evidenceId || "",
      beatId: beat.beatId || `B${String(index + 1).padStart(3, "0")}`,
      sourceText: textOf(beat.sourceText || beat.beatSummary),
      summary: textOf(beat.beatSummary || beat.sourceText),
      episodeNo: beat.episodeNo || null
    }))
    .filter((item) => item.sourceText || item.summary);
  return [...evidence, ...beatRefs].slice(0, limit);
}

function normalizeEvidenceRef(item, index = 0) {
  if (item && typeof item === "object") {
    return {
      evidenceId: item.id || item.evidenceId || `E${String(index + 1).padStart(3, "0")}`,
      beatId: item.beatId || item.relatedBeatIds?.[0] || "",
      sourceText: textOf(item.sourceText || item.summary),
      summary: textOf(item.summary || item.sourceText),
      episodeNo: item.episodeNo || null,
      evidenceType: item.evidenceType || "evidence"
    };
  }
  const text = textOf(item);
  return {
    evidenceId: `E_AUTO_${String(index + 1).padStart(3, "0")}`,
    beatId: "",
    sourceText: text,
    summary: text,
    episodeNo: null,
    evidenceType: "primitive"
  };
}

function evidenceIds(evidence = []) {
  return evidence.map((item) => item.evidenceId || item.beatId || item.sourceText).filter(Boolean);
}

function sourceEpisodes(evidence = []) {
  return [...new Set(evidence.map((item) => item.episodeNo).filter(Boolean))];
}

function hasUsableEvidence(evidence = []) {
  return evidence.some((item) => item.sourceText || item.beatId || item.evidenceId);
}

function analysisTitle(analysis = {}, input = {}) {
  return firstText(analysis.title, analysis.basicInfo?.title, input.title, "未命名案例");
}

function analysisCaseId(analysis = {}, input = {}) {
  return analysis.id || input.caseId || input.sourceCaseId || "current-analysis";
}

function primaryAudienceNeeds(analysis = {}) {
  return [
    ...(analysis.audienceNeedAnalysis?.primaryNeeds || []),
    ...(analysis.classificationTags?.audienceNeeds || []),
    ...(analysis.basicInfo?.subGenre || [])
  ].filter(Boolean).slice(0, 4);
}

function primaryGenres(analysis = {}) {
  return [...(analysis.basicInfo?.genre || []), ...(analysis.classificationTags?.genre || [])].filter(Boolean).slice(0, 4);
}

export function extractStoryBlueprintDemo(input = {}) {
  const analysis = input.analysis || input.currentAnalysis || {};
  const sourceEvidence = collectSourceEvidence(analysis, 10);
  const title = analysisTitle(analysis, input);
  const sourceCaseId = analysisCaseId(analysis, input);
  const needsReview = !hasUsableEvidence(sourceEvidence);
  return {
    id: stableId("blueprint", sourceCaseId),
    sourceCaseId,
    title,
    storyEngine: {
      oneLine: firstText(
        analysis.mainlineStructure?.drivingQuestion,
        analysis.hookAnalysis?.whyContinueWatching,
        "主角被卷入高压危机，用被低估的能力不断破局，每次胜利都打开更大的敌人或真相。"
      ),
      whyProtagonistIsPulledIn: firstText(
        analysis.mainlineStructure?.protagonistStartPoint,
        analysis.hookAnalysis?.conflictIntroduced,
        "开局危机把主角推到公共质疑场，主角如果不出手就会失去道德位置或生存空间。"
      ),
      whyMainlineContinues: firstText(
        analysis.obstacleAnalysis?.whyCannotBeSolvedAtOnce,
        analysis.mainlineStructure?.escalationLogic,
        "初始危机背后有更高层敌人和未解释能力规则，所以每次破局都会暴露下一层压力。"
      )
    },
    protagonistLoop: [
      "被低估或被质疑",
      "主角看到别人看不到的真相",
      "权威或反派阻拦",
      "主角用能力破局",
      "围观者震惊或关系改写",
      "更大的敌人/代价/谜团被引出"
    ],
    conflictEscalation: {
      logic: firstText(analysis.obstacleAnalysis?.obstacleEscalation, analysis.mainlineStructure?.escalationLogic, "从单点危机升级到背后势力，再升级到能力代价和身份真相。"),
      stages: (analysis.mainlineStructure?.stageStructure || []).map((stage) => ({
        stageNo: stage.stageNo,
        pressure: stage.mainConflict || stage.stageGoal,
        cost: stage.emotionalFunction || "本阶段代价待复核",
        upgrade: stage.majorTurningPoint || stage.endingHook
      }))
    },
    emotionalLoop: [
      "危机压低",
      "主角被质疑",
      "观众期待主角出手",
      "能力验证带来爽感",
      "反派失控或权威震惊",
      "结尾抛出更大悬念"
    ],
    relationshipEngine: {
      entranceRole: "被救者/见证者负责把主角带入资源场",
      pressureRole: "反派或权威负责质疑主角并制造即时冲突",
      rewardRole: "被主角改变的人负责提供信任、资源或情绪回报",
      misunderstandingRole: "围观者负责延迟认可，放大打脸爽感",
      antagonistRole: firstText(analysis.obstacleAnalysis?.antagonistSystem, "背后势力负责把单集危机串成主线压力")
    },
    suspenseEngine: {
      openingQuestion: firstText(analysis.hookAnalysis?.viewerQuestion, "主角到底凭什么能破局？"),
      escalationQuestions: [
        "危机的真正来源是谁？",
        "主角能力有什么规则和代价？",
        "被打脸者背后还有谁？",
        "主角身份或目标是否另有隐藏真相？"
      ],
      payoffRule: "每次回收一个小疑问，同时抛出一个更大问题。"
    },
    payoffDesign: {
      coolPoint: firstText(analysis.goldfingerAnalysis?.visibleFunction, "隐藏能力在公共场景中完成验证"),
      emotionalPayoff: firstText(analysis.endingAnalysis?.emotionalPayoff, analysis.audienceNeedAnalysis?.emotionalPromise, "尊严修复和专业崇拜被逐步兑现"),
      identityReveal: firstText(analysis.mainlineReversalAnalysis?.surfaceStory, "先用行为证明，再逐步揭开身份或能力本质"),
      risk: "如果只重复打脸而不升级代价、关系和信息量，爽感会快速疲劳。"
    },
    episodeFunctionMap: (analysis.episodeFunctionAnalysis || []).map((episode) => ({
      episodeNo: episode.episodeNo,
      title: episode.title,
      function: firstText(episode.characterFunction, episode.themeFunction, episode.summary),
      hook: episode.openingHook || "",
      payoff: episode.coolMoment || episode.emotionalBeat || "",
      nextQuestion: episode.cliffhanger || ""
    })),
    reusableSkeleton: [
      "公共或高压场景制造无法回避的危机",
      "权威误判和反派阻拦让主角处在低位",
      "主角用独特能力识别真相，但先被质疑",
      "破局后产生强验证爽点，并改写关系位置",
      "爽点之后立刻抛出能力规则、敌人层级或身份悬念"
    ],
    nonTransferableSurface: ["具体人物姓名", "火车/蛊毒/医生/蜈蚣/金蚕等原剧本表皮", "原文台词和特定场景调度"],
    sourceEvidence,
    confidence: needsReview ? 0.55 : 0.82,
    needsReview
  };
}

export const extractStoryBlueprint = extractStoryBlueprintDemo;

export function analyzeViralMechanismDemo(input = {}) {
  const analysis = input.analysis || {};
  const blueprint = input.blueprint || extractStoryBlueprintDemo(input);
  const sourceEvidence = collectSourceEvidence(analysis, 8);
  const needs = primaryAudienceNeeds(analysis);
  const needsReview = !hasUsableEvidence(sourceEvidence);
  return {
    id: stableId("mechanism", blueprint.sourceCaseId || analysisCaseId(analysis, input)),
    sourceCaseId: blueprint.sourceCaseId || analysisCaseId(analysis, input),
    audienceNeeds: needs.length ? needs : ["尊严修复", "专业崇拜", "强者隐藏"],
    addictiveDrivers: [
      "主角被低估后必然反击，形成稳定期待",
      "每次破局都会解释一个能力点，同时打开新疑问",
      "围观者从质疑到震惊，提供即时情绪回报"
    ],
    coolPointMechanisms: [
      "先压低主角社会位置，再让主角掌握唯一真相",
      "用权威误判放大主角能力验证的落差",
      "把爽点和信息增量绑定，避免只做机械打脸"
    ],
    curiosityDrivers: [
      blueprint.suspenseEngine?.openingQuestion || "主角能力来源是什么？",
      "危机背后是否有更高层黑手？",
      "能力是否存在代价或误用风险？"
    ],
    identificationPath: "观众先站在被误解的低位主角一边，再通过主角破局获得被看见、被承认、被仰望的补偿。",
    emotionalPayoffChain: [
      "危机或羞辱制造压抑",
      "质疑和阻拦延迟兑现",
      "主角出手释放爽感",
      "权威认可或反派失控完成补偿",
      "新悬念把情绪推入下一集"
    ],
    retentionHooks: [
      "结尾抛出背后敌人",
      "能力规则只揭一半",
      "救人/破局后关系位置发生变化",
      "反派升级或隐藏身份逼近"
    ],
    noveltySources: ["职业/能力规则的新鲜感", "低位外形与高能力的反差", "公共危机和专业判断结合"],
    fatigueRisks: [
      "连续只靠围观震惊和反派嘴硬会疲劳",
      "主角能力无限制会降低危机感",
      "关系只奖励不变化，会削弱中后段留存"
    ],
    whyItCanWork:
      "它把观众熟悉的低估打脸改造成一个可持续循环：危机给出压力，误判给出不公平，主角能力给出唯一解，破局后马上抛出更大敌人或能力问题，所以爽点、信息量和追看问题同时推进。",
    whyItMayFail:
      "如果后续只重复同一种公共危机和权威误判，而不增加能力代价、敌人层级、人物关系变化，观众会把模式识破为机械套路，爽感会迅速衰减。",
    sourceEvidence,
    confidence: needsReview ? 0.55 : 0.8,
    needsReview
  };
}

export const analyzeViralMechanism = analyzeViralMechanismDemo;

export function extractPatternCardsDemo(input = {}) {
  const analysis = input.analysis || {};
  const blueprint = input.blueprint || extractStoryBlueprintDemo(input);
  const mechanism = input.mechanism || analyzeViralMechanismDemo({ ...input, blueprint });
  const sourceCaseId = blueprint.sourceCaseId || analysisCaseId(analysis, input);
  const genres = primaryGenres(analysis);
  const needs = mechanism.audienceNeeds || primaryAudienceNeeds(analysis);
  const sourceEvidence = collectSourceEvidence(analysis, 12);
  const evidenceA = sourceEvidence.slice(0, 3);
  const evidenceB = sourceEvidence.slice(1, 4);
  const evidenceC = sourceEvidence.slice(2, 5);
  const cards = [
    {
      id: stableId("pattern", `${sourceCaseId}-public-crisis-hook`),
      name: "公共危机开局 + 权威误判 + 隐藏强者破局",
      sourceCaseId,
      sourceEpisodes: sourceEpisodes(evidenceA),
      sourceEvidence: evidenceA,
      surfacePlot: "原剧本用公共场景突发危机，让权威角色先给出错误判断，再由被低估主角发现真正原因并破局。",
      structuralFunction: "快速建立钩子、冲突、主角能力和观众追问。",
      characterFunction: "把主角从低位观察者推到唯一解的位置，完成首次能力验证。",
      audiencePsychology: "满足被轻视后证明自己的尊严修复，也制造对隐藏强者的专业崇拜。",
      abstractTemplate: "公共场景危机 -> 权威误判 -> 主角被质疑 -> 主角提出反常判断 -> 能力破局 -> 新悬念打开",
      variableSlots: {
        scene: ["火车", "医院", "项目会", "婚宴", "直播间"],
        crisis: ["中毒", "怪病", "数据事故", "舆论翻车", "命案"],
        authority: ["医生", "专家", "老编剧", "长老", "平台审核"],
        ability: ["医术", "数据预测", "系统识别", "心理画像", "玄术"]
      },
      applicableGenres: genres.length ? genres : ["都市逆袭", "高手下山", "职场爽剧"],
      applicableStages: ["开局", "前5集"],
      usageConstraints: ["必须有明确危机和可验证结果", "权威误判不能显得弱智", "主角能力要有规则或代价"],
      antiPatterns: ["只让群众震惊但没有信息增量", "主角无代价全能秒杀", "照搬原剧本火车/蛊毒表皮"],
      transferPrompt: "把公共危机、权威误判、隐藏强者破局三段机制迁移到新创意，替换 scene/crisis/authority/ability，不要复用原案例表皮。",
      scoringRubric: ["危机是否一眼可懂", "权威误判是否合理", "主角破局是否可验证", "结尾是否打开新问题"],
      confidence: hasUsableEvidence(evidenceA) ? 0.84 : 0.45,
      needsReview: !hasUsableEvidence(evidenceA),
      canPromoteToSkill: hasUsableEvidence(evidenceA)
    },
    {
      id: stableId("pattern", `${sourceCaseId}-ability-verification`),
      name: "主角能力验证：被质疑后用规则外信息破局",
      sourceCaseId,
      sourceEpisodes: sourceEpisodes(evidenceB),
      sourceEvidence: evidenceB,
      surfacePlot: "主角说出他人不知道的真相或判断，先被阻拦，随后用能力证实。",
      structuralFunction: "把设定展示变成冲突行动，避免干讲能力说明。",
      characterFunction: "暴露主角的专业能力、行动原则和隐藏背景。",
      audiencePsychology: "观众获得认知优越感，提前知道主角对而别人错。",
      abstractTemplate: "主角识别隐藏信息 -> 他人否定 -> 主角给出可验证动作 -> 结果证实主角判断",
      variableSlots: {
        hiddenInfo: ["病因", "数据趋势", "身份漏洞", "机关规则"],
        blocker: ["反派", "权威", "误解对象", "制度流程"],
        proofAction: ["救人", "反推数据", "当场复盘", "拆穿骗局"]
      },
      applicableGenres: genres.length ? genres : ["职场", "都市", "玄幻"],
      applicableStages: ["开局", "能力升级", "中段反转前"],
      usageConstraints: ["证明动作必须可视化", "隐藏信息要提前留痕", "不能每次都同一种证明方式"],
      antiPatterns: ["只靠主角口头解释", "所有配角集体降智", "能力没有边界"],
      transferPrompt: "为新创意设计一场能力验证：让主角看见隐藏信息，被阻拦，再用可视化动作证明判断。",
      scoringRubric: ["隐藏信息是否有伏笔", "阻拦是否有合理利益", "证明结果是否清楚", "是否带出人物原则"],
      confidence: hasUsableEvidence(evidenceB) ? 0.8 : 0.45,
      needsReview: !hasUsableEvidence(evidenceB),
      canPromoteToSkill: hasUsableEvidence(evidenceB)
    },
    {
      id: stableId("pattern", `${sourceCaseId}-escalation-ladder`),
      name: "冲突升级：小反派失败后牵出更高压迫系统",
      sourceCaseId,
      sourceEpisodes: sourceEpisodes(evidenceC),
      sourceEvidence: evidenceC,
      surfacePlot: "单集反派失败后不结束，而是转向背后势力，形成下一集压力。",
      structuralFunction: "把单点爽点串成连续主线，防止每集变成独立打脸。",
      characterFunction: "让主角每次胜利都承担更大后果，迫使目标升级。",
      audiencePsychology: "爽感刚兑现就出现更大威胁，形成继续观看的紧张期待。",
      abstractTemplate: "小危机被解决 -> 反派损失利益 -> 反派求助更高层 -> 更高层误判主角 -> 下一轮冲突升级",
      variableSlots: {
        minorVillain: ["投资人", "同事", "家族成员", "门派弟子"],
        higherSystem: ["资本方", "平台规则", "黑产组织", "宗门长老"],
        newPressure: ["封杀", "追杀", "审核", "舆论围攻"]
      },
      applicableGenres: genres.length ? genres : ["短剧强爽", "男频升级", "都市逆袭"],
      applicableStages: ["第2-10集", "中段升级"],
      usageConstraints: ["升级必须来自反派利益受损", "更高层压力要改变主角下一步目标"],
      antiPatterns: ["反派轮流送人头", "升级只加战力不加信息", "胜利没有后果"],
      transferPrompt: "为新创意设计一条反派升级链：每次主角破局都让小反派触发更高层压力。",
      scoringRubric: ["小反派动机是否清楚", "高层介入是否有利益逻辑", "主角目标是否被迫变化"],
      confidence: hasUsableEvidence(evidenceC) ? 0.76 : 0.45,
      needsReview: !hasUsableEvidence(evidenceC),
      canPromoteToSkill: hasUsableEvidence(evidenceC)
    },
    {
      id: stableId("pattern", `${sourceCaseId}-relationship-entry`),
      name: "人物关系入口：被救者/见证者转为资源入口",
      sourceCaseId,
      sourceEpisodes: sourceEpisodes(sourceEvidence.slice(0, 4)),
      sourceEvidence: sourceEvidence.slice(0, 4),
      surfacePlot: "主角救下或证明某个关键人物，让对方从陌生见证者转为信任入口。",
      structuralFunction: "用关系变化承接爽点，把单集破局转成后续资源和主线入口。",
      characterFunction: "让主角的行动原则被看见，也让配角承担奖励、误解或新压力功能。",
      audiencePsychology: "观众获得被认可和被需要的情绪补偿。",
      abstractTemplate: "关键人物处于危机 -> 主角破局 -> 对方改变态度 -> 提供资源/信息/新任务",
      variableSlots: {
        entryCharacter: ["被救老师", "平台负责人", "老编剧", "大小姐", "调查员"],
        resource: ["行业入口", "资金", "证据", "保护", "关键人脉"],
        relationshipShift: ["怀疑转信任", "羞辱转依赖", "误解转合作"]
      },
      applicableGenres: genres.length ? genres : ["都市", "职场", "甜宠", "权谋"],
      applicableStages: ["开局", "前5集", "阶段转场"],
      usageConstraints: ["关系变化要来自行动而不是硬贴", "资源入口要服务下一段冲突"],
      antiPatterns: ["被救者无条件倒贴", "资源奖励与主线无关", "关系不带来新问题"],
      transferPrompt: "把主角破局后的关系变化设计为下一阶段入口：被救者/见证者必须提供资源，同时引出新压力。",
      scoringRubric: ["关系转变是否可信", "资源是否推进主线", "是否引出新的冲突角色"],
      confidence: hasUsableEvidence(sourceEvidence.slice(0, 4)) ? 0.78 : 0.45,
      needsReview: !hasUsableEvidence(sourceEvidence.slice(0, 4)),
      canPromoteToSkill: hasUsableEvidence(sourceEvidence.slice(0, 4))
    },
    {
      id: stableId("pattern", `${sourceCaseId}-retention-hook`),
      name: "追看悬念：爽点后立刻抛出更大真相",
      sourceCaseId,
      sourceEpisodes: sourceEpisodes(sourceEvidence.slice(0, 5)),
      sourceEvidence: sourceEvidence.slice(0, 5),
      surfacePlot: "本集爽点兑现后，立刻出现能力来源、背后敌人或隐藏身份的新疑问。",
      structuralFunction: "避免爽点完成后情绪断档，把满足感转化为下一集问题。",
      characterFunction: "让主角每次解决问题后都必须面对更深层动机或代价。",
      audiencePsychology: "观众既获得即时满足，又担心下一层风险，形成继续观看动机。",
      abstractTemplate: "爽点兑现 -> 观众以为结束 -> 新信息出现 -> 下一集必须解释/应对",
      variableSlots: {
        payoff: ["救人成功", "数据反杀", "身份小揭露", "公开打脸"],
        biggerTruth: ["幕后黑手", "能力代价", "身份关系", "平台规则"],
        nextQuestion: ["谁在操控？", "能力从何而来？", "主角会付出什么代价？"]
      },
      applicableGenres: genres.length ? genres : ["短剧", "漫剧", "网文改编"],
      applicableStages: ["每集结尾", "阶段结尾", "中段揭示"],
      usageConstraints: ["新悬念必须和本集爽点相关", "不能只靠陌生人突然登场制造悬念"],
      antiPatterns: ["结尾只喊狠话", "悬念与本集事件无关", "连续拖延不回收"],
      transferPrompt: "为新创意的每次爽点后设计一个递进问题，让观众想知道更大真相而不是只等待下一次打脸。",
      scoringRubric: ["爽点和新悬念是否因果相连", "下一集问题是否具体", "是否承诺可回收信息"],
      confidence: hasUsableEvidence(sourceEvidence.slice(0, 5)) ? 0.78 : 0.45,
      needsReview: !hasUsableEvidence(sourceEvidence.slice(0, 5)),
      canPromoteToSkill: hasUsableEvidence(sourceEvidence.slice(0, 5))
    }
  ];
  return cards.map((card) => ({
    ...card,
    applicableAudienceNeeds: card.applicableAudienceNeeds || needs,
    sourceEvidence: card.sourceEvidence || [],
    canPromoteToSkill: Boolean(card.canPromoteToSkill && !card.needsReview)
  }));
}

export const extractPatternCards = extractPatternCardsDemo;

export function buildSkillAssetsFromPatternsDemo(input = {}) {
  const cards = Array.isArray(input.patternCards) ? input.patternCards : extractPatternCardsDemo(input);
  const groups = [
    {
      id: "public-crisis-hook",
      name: "公共危机开局破局 Skill",
      purpose: "把公共危机、权威误判、隐藏强者破局组合成可复用开头。",
      match: (card) => card.name.includes("公共危机") || card.name.includes("能力验证"),
      taskScope: ["analyzeScript", "extractPatternCards", "applyPatternsToNewIdea", "generateEpisodeOutline"]
    },
    {
      id: "retention-escalation",
      name: "冲突升级与追看钩子 Skill",
      purpose: "把小反派升级链和爽点后悬念组合成分集留存规则。",
      match: (card) => card.name.includes("冲突升级") || card.name.includes("追看悬念"),
      taskScope: ["generateEpisodeOutline", "auditPatternTransfer", "auditOutline"]
    },
    {
      id: "relationship-entry",
      name: "关系入口转资源 Skill",
      purpose: "把破局后的关系变化转成后续资源、误解和新压力。",
      match: (card) => card.name.includes("关系入口"),
      taskScope: ["applyPatternsToNewIdea", "generateMacroOutline", "generateEpisodeOutline"]
    }
  ];
  return groups
    .map((group) => {
      const selected = cards.filter(group.match);
      if (!selected.length) return null;
      const needsReview = selected.some((card) => card.needsReview || !hasUsableEvidence(card.sourceEvidence || []));
      return {
        id: stableId("skill-pattern", group.id),
        name: group.name,
        purpose: group.purpose,
        patternCardIds: selected.map((card) => card.id),
        taskScope: group.taskScope,
        genreScope: [...new Set(selected.flatMap((card) => card.applicableGenres || []))],
        audienceNeedScope: [...new Set(selected.flatMap((card) => card.applicableAudienceNeeds || card.audienceNeeds || []))],
        promptAdditions: selected.map((card) => card.transferPrompt),
        positiveExamples: selected.map((card) => `${card.name}：${card.abstractTemplate}`),
        negativeExamples: selected.flatMap((card) => card.antiPatterns || []).slice(0, 6),
        evaluationCriteria: selected.flatMap((card) => card.scoringRubric || []).slice(0, 10),
        usageConstraints: selected.flatMap((card) => card.usageConstraints || []).slice(0, 8),
        riskWarnings: selected.flatMap((card) => card.antiPatterns || []).slice(0, 8),
        modelPreference: {
          preferredModelIds: [],
          forbiddenModelIds: [],
          requireCapabilities: ["json"],
          allowFallback: true,
          fallbackStrategy: "按任务路由备用模型",
          notes: "Pattern Skill 需要稳定 JSON 输出，并保留 sourceEvidence。"
        },
        version: "1.0.0",
        status: needsReview ? "待复核" : "草稿",
        changelog: [
          {
            version: "1.0.0",
            summary: needsReview ? "由证据不足的 PatternCard 生成，需人工复核后才能启用。" : "由可追溯 PatternCard 组合生成。",
            createdAt: new Date().toISOString()
          }
        ],
        needsReview,
        sourcePatternCards: selected.map((card) => ({ id: card.id, name: card.name, needsReview: Boolean(card.needsReview) }))
      };
    })
    .filter(Boolean);
}

export const buildSkillAssetsFromPatterns = buildSkillAssetsFromPatternsDemo;

export function applyPatternsToNewIdeaDemo(input = {}) {
  const idea = textOf(input.idea || input.creativeInput || input.project?.creativeInput, "一个被封杀的天才 AI 编剧进入短剧公司，用数据预测爆款，被所有老编剧嘲笑");
  const cards = (Array.isArray(input.patternCards) && input.patternCards.length ? input.patternCards : extractPatternCardsDemo(input)).slice(0, 5);
  const protagonist = idea.includes("AI") ? "天才 AI 编剧" : "被低估的主角";
  const scene = idea.includes("公司") ? "短剧公司项目会" : "公共高压场景";
  const authority = idea.includes("编剧") ? "老编剧和主编" : "行业权威";
  const ability = idea.includes("数据") || idea.includes("AI") ? "数据预测爆款与结构诊断" : "独特能力";
  const crisis = idea.includes("封杀") ? "项目被封杀后即将失去投资" : "突发危机";
  const patternSelection = cards.map((card) => ({
    patternCardId: card.id,
    name: card.name,
    whyFit: card.name.includes("公共危机")
      ? "新创意同样需要开局高压场和权威质疑，用来验证主角能力。"
      : "该模式能把旧案例的追看机制迁移到新故事，而不复制表皮。"
  }));
  const variableMapping = {
    oldSurfaceToNewVariables: {
      "火车/公共危机": scene,
      "医生/权威误判": authority,
      "蛊毒/隐藏病因": crisis,
      "巫医识别": ability,
      "被救者转资源入口": "被主角救回项目的制片人/平台运营"
    },
    slots: {
      scene,
      crisis,
      authority,
      ability,
      protagonist,
      rewardCharacter: "濒临下线项目的负责人"
    }
  };
  const firstFiveEpisodes = [
    {
      episodeNo: 1,
      title: "项目会公开处刑",
      function: "公共危机开局，老编剧质疑主角，主角用数据指出真正流失点。",
      patternCardIds: [cards[0]?.id, cards[1]?.id].filter(Boolean),
      hook: "被封杀的主角被迫在项目会当场救一个必死项目。"
    },
    {
      episodeNo: 2,
      title: "数据预测被嘲笑",
      function: "能力验证，主角给出反常判断，被权威阻拦后用历史留存曲线证明。",
      patternCardIds: [cards[1]?.id].filter(Boolean),
      hook: "他预测的爆点和所有老编剧的经验完全相反。"
    },
    {
      episodeNo: 3,
      title: "小爆款反杀",
      function: "第一次爽点兑现，项目数据回升，但引来更高层质疑。",
      patternCardIds: [cards[2]?.id, cards[4]?.id].filter(Boolean),
      hook: "平台后台显示异常数据，背后有人故意压量。"
    },
    {
      episodeNo: 4,
      title: "负责人转为盟友",
      function: "关系入口，项目负责人从怀疑转为合作，并提供旧案线索。",
      patternCardIds: [cards[3]?.id].filter(Boolean),
      hook: "主角发现自己被封杀不是因为失败，而是因为曾经预测中过某个禁区。"
    },
    {
      episodeNo: 5,
      title: "真正的算法黑箱",
      function: "追看升级，主角胜利后发现平台推荐规则被人操控。",
      patternCardIds: [cards[2]?.id, cards[4]?.id].filter(Boolean),
      hook: "如果继续查，他的新项目会被全平台拉黑。"
    }
  ];
  return {
    patternSelection,
    variableMapping,
    newStoryEngine: `${protagonist}被迫进入${scene}，用${ability}拆穿${authority}的误判，每次救回项目都会触碰更高层的平台和资本压力。`,
    newProtagonistLoop: [
      "被老经验否定",
      "发现数据背后的真实观众情绪",
      "提出反常改法",
      "被质疑或阻拦",
      "用上线数据兑现打脸",
      "引出算法黑箱或资本封锁"
    ],
    firstFiveEpisodes,
    outlineSeed: {
      logline: idea,
      reusableMechanism: "公共危机开局 + 能力验证 + 反派升级 + 关系入口 + 爽点后新悬念",
      stageGoal: "前5集完成主角能力验证、第一盟友建立和平台黑箱悬念。"
    },
    risks: [
      "AI/数据能力如果没有限制，会变成万能外挂。",
      "不要照搬原案例火车、蛊毒、医生等表皮元素。",
      "老编剧不能集体降智，需要有可理解的经验主义立场。"
    ],
    patternCardIds: cards.map((card) => card.id)
  };
}

export const applyPatternsToNewIdea = applyPatternsToNewIdeaDemo;

export function auditPatternTransferDemo(input = {}) {
  const idea = textOf(input.idea || input.creativeInput || input.project?.creativeInput);
  const result = input.transferResult || input.output || {};
  const text = JSON.stringify({ idea, result });
  const surfaceTerms = ["火车", "蛊毒", "医生", "蜈蚣", "金蚕", "林清", "孙大为"];
  const copiedSurfaceRisks = surfaceTerms
    .filter((term) => text.includes(term))
    .map((term) => ({
      term,
      risk: `迁移结果出现原案例表皮元素“${term}”，疑似换皮抄剧情。`,
      repair: "替换为新创意自己的行业场景、危机和能力表现。"
    }));
  const patternIds = arrayOf(result.patternCardIds || result.patternSelection?.map?.((item) => item.patternCardId)).flat();
  const episodeCount = Array.isArray(result.firstFiveEpisodes) ? result.firstFiveEpisodes.length : 0;
  const mechanismCoverage = {
    publicCrisis: text.includes("项目会") || text.includes("公共") || text.includes("危机"),
    abilityVerification: text.includes("数据") || text.includes("能力") || text.includes("预测"),
    escalation: text.includes("更高层") || text.includes("平台") || text.includes("资本"),
    relationshipEntry: text.includes("盟友") || text.includes("负责人") || text.includes("资源"),
    retentionHook: text.includes("悬念") || text.includes("黑箱") || text.includes("下一")
  };
  const covered = Object.values(mechanismCoverage).filter(Boolean).length;
  const transferScore = Math.max(35, Math.min(95, covered * 16 + episodeCount * 2 - copiedSurfaceRisks.length * 12));
  return {
    transferScore,
    copiedSurfaceRisks,
    mechanismCoverage,
    missingAudiencePayoff: covered < 4 ? ["爽点、关系变化或结尾追看钩子覆盖不足，需要补足至少 4 类机制。"] : [],
    weakCharacterMotivation: text.includes("被迫") || text.includes("封杀") ? [] : ["主角为什么必须进入新故事不够清楚，需要补一个不可退出的压力。"],
    suggestedRepairs: [
      ...(copiedSurfaceRisks.length ? ["删除火车/蛊毒/医生等原案例表皮，换成新创意的项目会、数据事故、平台黑箱。"] : []),
      "给 AI/数据能力增加限制，例如只能预测情绪趋势，不能直接知道所有答案。",
      "每集结尾都要把一次小胜利转化为更高层压力或新疑问。",
      "让被主角帮助的人承担资源入口，同时也带来新的关系代价。"
    ],
    patternCardIds: patternIds,
    needsReview: copiedSurfaceRisks.length > 0 || covered < 4
  };
}

export const auditPatternTransfer = auditPatternTransferDemo;
