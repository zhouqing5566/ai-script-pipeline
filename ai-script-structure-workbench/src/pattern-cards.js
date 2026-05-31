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

function uniqueList(items = []) {
  return [...new Set(items.map((item) => textOf(item)).filter(Boolean))];
}

function normalizeSurfaceTerms(items = []) {
  const raw = Array.isArray(items) ? items : [items];
  const generic = new Set(["具体人物姓名", "原剧本表皮", "原文台词", "特定场景调度", "等", "表皮", "元素", "不要照搬", "原案例"]);
  return uniqueList(
    raw
      .flatMap((item) =>
        textOf(item)
          .replace(/^不要照搬[:：]/, "")
          .replace(/等原剧本表皮/g, "")
          .split(/[、，,；;\/\s]+|和|及/)
      )
      .map((item) => item.trim())
      .filter((item) => item.length > 1 && !generic.has(item))
  );
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

function evidenceMatchesId(item, id) {
  if (!id) return false;
  return item.evidenceId === id || item.beatId === id || item.id === id || item.relatedBeatIds?.includes?.(id);
}

function evidenceForPattern(analysis = {}, pattern = {}, fallback = []) {
  const ids = [...(pattern.sourceEvidenceIds || []), ...(pattern.sourceBeatIds || []), ...(pattern.evidenceIds || []), ...(pattern.evidenceBeatIds || [])];
  if (!ids.length) return fallback;
  const all = collectSourceEvidence(analysis, 80);
  const matched = all.filter((item) => ids.some((id) => evidenceMatchesId(item, id)));
  return matched.length ? matched : fallback;
}

function categoryForPatternSeed(seed = {}, index = 0) {
  const text = `${seed.title || ""} ${seed.summary || ""} ${seed.structureFunction || ""} ${seed.sourceText || ""}`;
  if (/开头|钩子|危机|公共|高压|权威|误判|羞辱|退婚/.test(text)) return "hook";
  if (/能力|金手指|验证|识破|看见|识别|系统|医术|玄术|数据/.test(text)) return "ability";
  if (/升级|反派|敌人|压力|更大|背后|代价|阻碍/.test(text)) return "escalation";
  if (/关系|被救|见证|入口|信任|资源|盟友|奖励/.test(text)) return "relationship";
  if (/悬念|追看|结尾|真相|伏笔|反转|疑问|来源/.test(text)) return "retention";
  return ["hook", "ability", "escalation", "relationship", "retention"][index % 5];
}

const patternCategoryPresets = {
  hook: {
    name: "开局钩子模式",
    structuralFunction: "快速建立危机、误判、主角低位和观众追问。",
    characterFunction: "把主角推到必须行动的位置，让能力或原则通过行动被看见。",
    audiencePsychology: "危机压低和被质疑延迟兑现，放大尊严修复和专业崇拜。",
    abstractTemplate: "高压场景 -> 权威/大众误判 -> 主角被质疑 -> 反常判断 -> 破局 -> 新悬念",
    variableSlots: {
      scene: ["公共场景", "专业现场", "家族宴会", "项目会", "直播间"],
      crisis: ["突发危机", "专业难题", "身份羞辱", "舆论事故"],
      authority: ["专家", "上位者", "资深同行", "规则制定者"],
      ability: ["主角独特判断", "专业技能", "隐藏身份", "系统能力"]
    },
    applicableStages: ["开局", "前5集"],
    usageConstraints: ["危机必须一眼可懂", "权威误判要有经验或利益逻辑", "主角破局必须可验证"],
    antiPatterns: ["只让群众震惊但没有信息增量", "权威集体降智", "照搬原案例场景和道具"],
    scoringRubric: ["钩子是否立即成立", "主角低位是否清楚", "破局是否可视化", "结尾是否打开下一问"]
  },
  ability: {
    name: "主角能力验证模式",
    structuralFunction: "把设定展示转化为冲突行动，让能力在压力下被验证。",
    characterFunction: "暴露主角的专业能力、行动原则、隐藏代价或误判。",
    audiencePsychology: "观众提前知道主角更接近真相，获得认知优越感和期待。",
    abstractTemplate: "隐藏信息 -> 主角识别 -> 他人否定 -> 可视化证明 -> 关系位置变化",
    variableSlots: {
      hiddenInfo: ["隐藏病因", "数据趋势", "身份漏洞", "案发细节", "资源缺口"],
      blocker: ["反派", "权威", "制度流程", "误解对象"],
      proofAction: ["救人", "复盘", "上线验证", "当场拆穿", "资源调度"]
    },
    applicableStages: ["开局", "能力升级", "中段反转前"],
    usageConstraints: ["隐藏信息要能回看命中", "证明动作必须有结果反馈", "能力要有边界"],
    antiPatterns: ["只靠主角口头解释", "没有代价的万能外挂", "每次证明方式完全重复"],
    scoringRubric: ["隐藏信息是否有依据", "阻拦是否合理", "证明是否清楚", "是否带出人物原则"]
  },
  escalation: {
    name: "冲突升级模式",
    structuralFunction: "把单点爽点串成连续主线，让每次胜利引出更高层压力。",
    characterFunction: "迫使主角目标升级，也暴露反派系统和主角承压方式。",
    audiencePsychology: "爽点刚兑现就出现更大威胁，形成继续追看的紧张期待。",
    abstractTemplate: "小危机解决 -> 反派利益受损 -> 更高层介入 -> 主角目标被迫升级",
    variableSlots: {
      minorVillain: ["同事", "投资人", "家族成员", "打假者", "竞争对手"],
      higherSystem: ["资本方", "平台规则", "组织黑手", "家族权力", "末世秩序"],
      newPressure: ["封杀", "追杀", "审查", "舆论围攻", "资源断供"]
    },
    applicableStages: ["第2-10集", "中段升级"],
    usageConstraints: ["升级必须来自利益链", "更高层压力要改变主角下一步目标"],
    antiPatterns: ["反派轮流送人头", "只加战力不加信息", "胜利没有后果"],
    scoringRubric: ["反派动机是否清楚", "升级是否有因果", "主角目标是否变化"]
  },
  relationship: {
    name: "人物关系入口模式",
    structuralFunction: "把一次破局转成资源入口、误解变化或下一阶段任务。",
    characterFunction: "让主角被看见，也让配角承担奖励、压力或新矛盾功能。",
    audiencePsychology: "用被认可、被需要、被偏爱的情绪补偿承接爽点。",
    abstractTemplate: "关键人物受困 -> 主角破局 -> 态度变化 -> 提供资源/信息/新任务",
    variableSlots: {
      entryCharacter: ["被救者", "见证者", "负责人", "客户", "家族关键人"],
      resource: ["证据", "资金", "人脉", "权限", "庇护"],
      relationshipShift: ["怀疑转信任", "羞辱转依赖", "误解转合作"]
    },
    applicableStages: ["开局", "前5集", "阶段转场"],
    usageConstraints: ["关系变化要来自行动", "资源入口必须推进下一段冲突"],
    antiPatterns: ["被救者无条件倒贴", "资源奖励与主线无关", "关系不带来新问题"],
    scoringRubric: ["关系转变是否可信", "资源是否推进主线", "是否引出新冲突"]
  },
  retention: {
    name: "追看悬念模式",
    structuralFunction: "把满足感转化为下一集问题，避免爽点完成后情绪断档。",
    characterFunction: "让主角每次解决问题后都必须面对更深层动机或代价。",
    audiencePsychology: "观众既获得即时满足，又担心下一层风险。",
    abstractTemplate: "爽点兑现 -> 观众以为结束 -> 新信息出现 -> 下一集必须解释/应对",
    variableSlots: {
      payoff: ["救人成功", "数据反杀", "身份小揭露", "公开打脸"],
      biggerTruth: ["幕后黑手", "能力代价", "身份关系", "规则黑箱"],
      nextQuestion: ["谁在操控？", "能力从何而来？", "主角会付出什么代价？"]
    },
    applicableStages: ["每集结尾", "阶段结尾", "中段揭示"],
    usageConstraints: ["新悬念必须和本集爽点相关", "悬念要承诺可回收"],
    antiPatterns: ["结尾只喊狠话", "悬念与本集事件无关", "连续拖延不回收"],
    scoringRubric: ["爽点和悬念是否因果相连", "下一问是否具体", "是否承诺可回收"]
  }
};

function collectPatternSeeds(analysis = {}, blueprint = {}, sourceCaseId = "") {
  const sourceEvidence = collectSourceEvidence(analysis, 80);
  const seeds = [];
  (analysis.reusablePatterns || []).forEach((pattern, index) => {
    const evidence = evidenceForPattern(analysis, pattern, sourceEvidence.slice(index, index + 3));
    seeds.push({
      source: "reusablePatterns",
      title: pattern.title || pattern.name || `可复用模式 ${index + 1}`,
      summary: firstText(pattern.description, pattern.whyItWorks, pattern.emotionalMechanism),
      structureFunction: firstText(pattern.plotFunction, pattern.structureTemplate, pattern.patternType),
      category: categoryForPatternSeed(pattern, index),
      sourceEvidence: evidence,
      sourceCaseId,
      sourceEpisodes: pattern.exampleEpisodes || sourceEpisodes(evidence),
      variableSlots: pattern.variableSlots,
      antiPatterns: pattern.antiPatterns,
      transferPrompt: pattern.reusePrompt,
      scoringRubric: pattern.scoringRubric
    });
  });
  (analysis.episodeBeatLedger || []).forEach((beat, index) => {
    const evidence = [normalizeEvidenceRef({ ...beat, id: beat.evidenceId, beatId: beat.beatId }, index)];
    seeds.push({
      source: "episodeBeatLedger",
      title: firstText(beat.structureFunction, beat.reusableValue, beat.beatSummary, `Beat 模式 ${index + 1}`),
      summary: firstText(beat.reusableValue, beat.beatSummary, beat.sourceText),
      structureFunction: firstText(beat.structureFunction, beat.conflict, "剧情 beat 功能"),
      category: categoryForPatternSeed(beat, index),
      sourceEvidence: evidence,
      sourceCaseId,
      sourceEpisodes: sourceEpisodes(evidence)
    });
  });
  ["hookEvidence", "conflictBeats", "goldfingerEvidence", "suspenseEvidence", "characterMentions", "endingEvidence"].forEach((group) => {
    (analysis.evidenceLedger?.[group] || []).forEach((item, index) => {
      const evidence = [normalizeEvidenceRef(item, index)];
      seeds.push({
        source: `evidenceLedger.${group}`,
        title: firstText(item.summary, item.sourceText, `${group} 模式 ${index + 1}`),
        summary: firstText(item.summary, item.sourceText),
        structureFunction: item.evidenceType || group,
        category: categoryForPatternSeed({ ...item, structureFunction: group }, index),
        sourceEvidence: evidence,
        sourceCaseId,
        sourceEpisodes: sourceEpisodes(evidence)
      });
    });
  });
  (blueprint.reusableSkeleton || []).forEach((step, index) => {
    seeds.push({
      source: "storyBlueprint.reusableSkeleton",
      title: step,
      summary: step,
      structureFunction: "可复用骨架步骤",
      category: ["hook", "ability", "escalation", "relationship", "retention"][index % 5],
      sourceEvidence: sourceEvidence.slice(index, index + 2),
      sourceCaseId,
      sourceEpisodes: sourceEpisodes(sourceEvidence.slice(index, index + 2))
    });
  });
  return dedupePatternSeeds(seeds);
}

function dedupePatternSeeds(seeds = []) {
  const seen = new Set();
  return seeds.filter((seed) => {
    const key = `${seed.category}:${seed.title}`.slice(0, 120);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ensureAtLeastFiveCategorySeeds(seeds = [], analysis = {}, blueprint = {}, sourceCaseId = "") {
  const next = [...seeds];
  const sourceEvidence = collectSourceEvidence(analysis, 12);
  for (const category of ["hook", "ability", "escalation", "relationship", "retention"]) {
    if (next.some((seed) => seed.category === category)) continue;
    const preset = patternCategoryPresets[category];
    next.push({
      source: "categoryFallbackFromAnalysis",
      title: preset.name,
      summary: preset.abstractTemplate,
      structureFunction: preset.structuralFunction,
      category,
      sourceEvidence: sourceEvidence.slice(0, 2),
      sourceCaseId,
      sourceEpisodes: sourceEpisodes(sourceEvidence.slice(0, 2))
    });
  }
  return next;
}

function patternCardFromSeed(seed, context = {}, index = 0) {
  const preset = patternCategoryPresets[seed.category] || patternCategoryPresets.hook;
  const evidence = seed.sourceEvidence || [];
  const hasEvidence = hasUsableEvidence(evidence);
  return {
    id: stableId("pattern", `${seed.sourceCaseId}-${seed.category}-${seed.title}-${index}`),
    name: seed.title === preset.name ? preset.name : `${preset.name}｜${seed.title}`.slice(0, 60),
    sourceCaseId: seed.sourceCaseId,
    sourceEpisodes: seed.sourceEpisodes?.length ? seed.sourceEpisodes : sourceEpisodes(evidence),
    sourceEvidence: evidence,
    sourceSeedType: seed.source,
    patternCategory: seed.category,
    surfacePlot: firstText(seed.summary, evidence[0]?.summary, evidence[0]?.sourceText, "原案例桥段待复核"),
    structuralFunction: firstText(seed.structureFunction, preset.structuralFunction),
    characterFunction: preset.characterFunction,
    audiencePsychology: preset.audiencePsychology,
    abstractTemplate: firstText(seed.abstractTemplate, preset.abstractTemplate),
    variableSlots: seed.variableSlots && typeof seed.variableSlots === "object" ? seed.variableSlots : preset.variableSlots,
    applicableGenres: context.genres.length ? context.genres : ["短剧", "漫剧", "网文改编"],
    applicableAudienceNeeds: context.needs.length ? context.needs : ["尊严修复", "公平清算", "认知优越感"],
    applicableStages: preset.applicableStages,
    usageConstraints: preset.usageConstraints,
    antiPatterns: uniqueList([...(seed.antiPatterns || []), ...(preset.antiPatterns || []), ...(context.nonTransferableSurface || []).map((item) => `不要照搬：${item}`)]),
    transferPrompt: firstText(seed.transferPrompt, `${preset.name}：迁移 ${preset.abstractTemplate}，只替换变量槽，不复制原案例表皮。`),
    scoringRubric: seed.scoringRubric?.length ? seed.scoringRubric : preset.scoringRubric,
    nonTransferableSurface: context.nonTransferableSurface || [],
    confidence: hasEvidence ? 0.72 + Math.min(0.14, evidence.length * 0.03) : 0.42,
    needsReview: !hasEvidence,
    canPromoteToSkill: hasEvidence
  };
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
  const nonTransferableSurface = normalizeSurfaceTerms(blueprint.nonTransferableSurface || []);
  const seeds = ensureAtLeastFiveCategorySeeds(collectPatternSeeds(analysis, blueprint, sourceCaseId), analysis, blueprint, sourceCaseId);
  const picked = [];
  for (const category of ["hook", "ability", "escalation", "relationship", "retention"]) {
    const seed = seeds.find((item) => item.category === category && !picked.includes(item)) || seeds.find((item) => !picked.includes(item));
    if (seed) picked.push(seed);
  }
  for (const seed of seeds) {
    if (picked.length >= Math.max(5, Math.min(8, seeds.length))) break;
    if (!picked.includes(seed)) picked.push(seed);
  }
  return picked.map((seed, index) => {
    const card = patternCardFromSeed(seed, { genres, needs, nonTransferableSurface }, index);
    return {
      ...card,
      applicableAudienceNeeds: card.applicableAudienceNeeds || needs,
      sourceEvidence: card.sourceEvidence || [],
      canPromoteToSkill: Boolean(card.canPromoteToSkill && !card.needsReview)
    };
  });
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

const ideaProfiles = [
  {
    name: "女法医",
    keywords: ["女法医", "法医", "尸检", "刑侦"],
    protagonist: "被质疑的女法医",
    scene: "刑侦会议/案发现场",
    crisis: "疑难命案和尸检结论被权威否定",
    authority: "刑警队长/资深法医",
    ability: "尸检细节重建和微表情推理",
    rewardCharacter: "年轻刑警/死者家属",
    antagonistSystem: "连环凶手与警队内鬼",
    suspenseSource: "尸体留下的反常痕迹"
  },
  {
    name: "玄学主播",
    keywords: ["玄学主播", "直播", "风水", "算命", "凶宅"],
    protagonist: "落魄玄学主播",
    scene: "直播间/凶宅连麦现场",
    crisis: "连麦求助者遭遇无法解释的怪事",
    authority: "打假博主/平台审核",
    ability: "看相、风水和因果线索识别",
    rewardCharacter: "求助者/榜一老板",
    antagonistSystem: "打假团队与邪术组织",
    suspenseSource: "弹幕里提前出现的死亡预告"
  },
  {
    name: "复仇千金",
    keywords: ["复仇千金", "千金", "继妹", "豪门", "订婚宴"],
    protagonist: "重生复仇千金",
    scene: "豪门宴会/董事会",
    crisis: "身份和家产被夺后的公开羞辱",
    authority: "家族长辈/未婚夫",
    ability: "前世记忆和人心识别",
    rewardCharacter: "被她救下的盟友/隐藏投资人",
    antagonistSystem: "继妹、未婚夫和家族利益网",
    suspenseSource: "母亲死亡真相"
  },
  {
    name: "商战操盘手",
    keywords: ["商战", "操盘手", "资本", "并购", "股权"],
    protagonist: "被踢出局的商战操盘手",
    scene: "并购谈判桌/董事会",
    crisis: "公司即将被恶意收购",
    authority: "董事长/投行专家",
    ability: "资本结构推演和资金链破局",
    rewardCharacter: "濒危公司的创始人",
    antagonistSystem: "资本联盟与内鬼董事",
    suspenseSource: "隐藏股权协议"
  },
  {
    name: "末世囤货",
    keywords: ["末世", "囤货", "重生", "灾变", "物资"],
    protagonist: "提前知道灾变的囤货者",
    scene: "灾变前社区/仓储中心",
    crisis: "物资短缺和邻里道德绑架",
    authority: "物业/救援队/社区话事人",
    ability: "灾变预判和资源调度",
    rewardCharacter: "被救下的医生/工程师",
    antagonistSystem: "掠夺团伙和失序社区",
    suspenseSource: "灾变真正来源"
  },
  {
    name: "AI 编剧",
    keywords: ["AI 编剧", "短剧公司", "数据预测", "老编剧", "爆款"],
    protagonist: "被封杀的天才 AI 编剧",
    scene: "短剧公司项目会",
    crisis: "项目被封杀后即将失去投资",
    authority: "老编剧和主编",
    ability: "数据预测爆款与结构诊断",
    rewardCharacter: "濒临下线项目的负责人",
    antagonistSystem: "平台算法黑箱与资本封锁",
    suspenseSource: "曾经命中过的行业禁区"
  }
];

function guessProtagonist(idea = "") {
  const match = textOf(idea).match(/(?:一个|一位|某个)([^，。,.；;]{2,18}?)(?:进入|回到|来到|在|被|用|靠|发现|遭遇|必须|为了)/);
  return match?.[1]?.trim() || "被低估的主角";
}

function inferFallbackVariables(idea = "") {
  const text = textOf(idea);
  const protagonist = guessProtagonist(text);
  return {
    protagonist,
    scene: /公司|职场|项目|平台/.test(text) ? "项目会/业务现场" : /直播|主播/.test(text) ? "直播间" : /豪门|宴会|家族/.test(text) ? "宴会/家族会议" : "公共高压场景",
    crisis: /封杀|失败|下线/.test(text) ? "项目失败和公开质疑" : /命案|尸|案/.test(text) ? "无法解释的案件危机" : /末世|灾/.test(text) ? "生存秩序崩塌" : "突发危机和公开误判",
    authority: /公司|项目|平台/.test(text) ? "行业权威/平台负责人" : /案|警|法医/.test(text) ? "资深专家/办案负责人" : "规则制定者/上位者",
    ability: /AI|数据|算法/.test(text) ? "数据预测和结构诊断" : /玄|风水|算命/.test(text) ? "玄学识别和因果判断" : /重生|前世/.test(text) ? "前世记忆和局势预判" : "独特判断能力",
    rewardCharacter: "被主角救下或说服的关键人物",
    antagonistSystem: /资本|平台|算法/.test(text) ? "平台规则与资本压力" : "背后利益系统",
    suspenseSource: /真相|秘密|黑箱/.test(text) ? "被隐藏的真相" : "危机背后的真正来源",
    matchedProfile: "",
    confidence: 0.48
  };
}

export function extractIdeaVariables(idea = "") {
  const text = textOf(idea);
  const profile = ideaProfiles.find((item) => item.keywords.some((keyword) => text.includes(keyword)));
  if (profile) {
    const { keywords, name, ...variables } = profile;
    return { ...variables, matchedProfile: name, confidence: 0.86 };
  }
  return inferFallbackVariables(text);
}

export function applyPatternsToNewIdeaDemo(input = {}) {
  const idea = textOf(input.idea || input.creativeInput || input.project?.creativeInput, "一个被封杀的天才 AI 编剧进入短剧公司，用数据预测爆款，被所有老编剧嘲笑");
  const cards = (Array.isArray(input.patternCards) && input.patternCards.length ? input.patternCards : extractPatternCardsDemo(input)).slice(0, 5);
  const variables = extractIdeaVariables(idea);
  const patternSelection = cards.map((card) => ({
    patternCardId: card.id,
    name: card.name,
    whyFit:
      card.patternCategory === "hook"
        ? `新创意可以在${variables.scene}制造${variables.crisis}，用来验证${variables.protagonist}的能力。`
        : "该模式能把旧案例的追看机制迁移到新故事，而不复制表皮。"
  }));
  const variableMapping = {
    oldSurfaceToNewVariables: {
      "公共危机场景": variables.scene,
      "权威误判者": variables.authority,
      "隐藏危机": variables.crisis,
      "主角破局能力": variables.ability,
      "奖励/入口角色": variables.rewardCharacter,
      "反派升级系统": variables.antagonistSystem,
      "追看悬念源": variables.suspenseSource
    },
    slots: {
      protagonist: variables.protagonist,
      scene: variables.scene,
      crisis: variables.crisis,
      authority: variables.authority,
      ability: variables.ability,
      rewardCharacter: variables.rewardCharacter,
      antagonistSystem: variables.antagonistSystem,
      suspenseSource: variables.suspenseSource
    }
  };
  const firstFiveEpisodes = [
    {
      episodeNo: 1,
      title: `${variables.scene}公开危机`,
      function: `公共危机开局：${variables.authority}误判${variables.crisis}，${variables.protagonist}被迫用${variables.ability}给出反常判断。`,
      patternCardIds: [cards[0]?.id, cards[1]?.id].filter(Boolean),
      hook: `${variables.protagonist}在${variables.scene}遇到${variables.crisis}，所有人都不相信他/她的判断。`
    },
    {
      episodeNo: 2,
      title: `${variables.ability}第一次被质疑`,
      function: `能力验证：主角给出只有${variables.ability}才能发现的信息，被${variables.authority}阻拦后完成可视化证明。`,
      patternCardIds: [cards[1]?.id].filter(Boolean),
      hook: `${variables.authority}坚持旧判断，主角必须当场证明自己不是胡说。`
    },
    {
      episodeNo: 3,
      title: `${variables.rewardCharacter}成为入口`,
      function: `关系入口：${variables.rewardCharacter}因主角破局改变态度，给出资源、证据或下一阶段入口。`,
      patternCardIds: [cards[2]?.id, cards[4]?.id].filter(Boolean),
      hook: `${variables.rewardCharacter}透露：这次危机不是偶然，背后还有更大压力。`
    },
    {
      episodeNo: 4,
      title: `${variables.antagonistSystem}浮出水面`,
      function: `冲突升级：第一次破局触动${variables.antagonistSystem}，小反派失败后牵出更高层阻力。`,
      patternCardIds: [cards[3]?.id].filter(Boolean),
      hook: `${variables.antagonistSystem}开始反击，主角发现胜利会带来更大后果。`
    },
    {
      episodeNo: 5,
      title: `${variables.suspenseSource}打开`,
      function: `追看悬念：爽点兑现后立刻抛出${variables.suspenseSource}，让故事从单点破局进入主线谜团。`,
      patternCardIds: [cards[2]?.id, cards[4]?.id].filter(Boolean),
      hook: `如果继续追查${variables.suspenseSource}，主角将正面撞上${variables.antagonistSystem}。`
    }
  ];
  return {
    patternSelection,
    variableMapping,
    newStoryEngine: `${variables.protagonist}被卷入${variables.scene}的${variables.crisis}，用${variables.ability}拆穿${variables.authority}的误判；每次破局都会让${variables.antagonistSystem}升级，并逼近${variables.suspenseSource}。`,
    newProtagonistLoop: [
      `被${variables.authority}否定`,
      `发现${variables.crisis}背后的异常`,
      "提出反常改法",
      "被质疑或阻拦",
      `用${variables.ability}完成验证`,
      `引出${variables.antagonistSystem}或${variables.suspenseSource}`
    ],
    firstFiveEpisodes,
    outlineSeed: {
      logline: idea,
      reusableMechanism: "公共危机开局 + 能力验证 + 反派升级 + 关系入口 + 爽点后新悬念",
      stageGoal: `前5集完成${variables.protagonist}能力验证、${variables.rewardCharacter}入口建立和${variables.suspenseSource}悬念。`
    },
    risks: [
      `${variables.ability}必须有边界、代价或误判空间，避免变成万能外挂。`,
      "不要照搬原案例表皮元素，只迁移危机、误判、验证、升级和追看机制。",
      `${variables.authority}不能集体降智，需要有可理解的经验、利益或规则立场。`
    ],
    patternCardIds: cards.map((card) => card.id),
    extractedIdeaVariables: variables
  };
}

export const applyPatternsToNewIdea = applyPatternsToNewIdeaDemo;

function collectNonTransferableSurfaceTerms(input = {}) {
  const cards = Array.isArray(input.patternCards) ? input.patternCards : [];
  const terms = [
    ...normalizeSurfaceTerms(input.blueprint?.nonTransferableSurface || []),
    ...normalizeSurfaceTerms(input.sourceCase?.nonTransferableSurface || []),
    ...normalizeSurfaceTerms(input.sourceCase?.storyBlueprint?.nonTransferableSurface || []),
    ...normalizeSurfaceTerms(input.sourceCase?.blueprint?.nonTransferableSurface || []),
    ...normalizeSurfaceTerms(input.transferResult?.sourceNonTransferableSurface || []),
    ...normalizeSurfaceTerms(cards.flatMap((card) => card.nonTransferableSurface || [])),
    ...normalizeSurfaceTerms(
      cards
        .flatMap((card) => card.antiPatterns || [])
        .filter((item) => String(item).includes("照搬") || String(item).includes("不要"))
    )
  ];
  return uniqueList(terms.length ? terms : ["火车", "蛊毒", "医生", "蜈蚣", "金蚕"]);
}

export function auditPatternTransferDemo(input = {}) {
  const idea = textOf(input.idea || input.creativeInput || input.project?.creativeInput);
  const result = input.transferResult || input.output || {};
  const text = JSON.stringify({ idea, result });
  const variables = result.extractedIdeaVariables || extractIdeaVariables(idea);
  const surfaceTerms = collectNonTransferableSurfaceTerms(input);
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
    publicCrisis: text.includes(variables.scene) || /公共|危机|高压|现场/.test(text),
    abilityVerification: text.includes(variables.ability) || /能力|验证|识别|预测|推理|调度|证明/.test(text),
    escalation: text.includes(variables.antagonistSystem) || /更高层|反派|系统|资本|平台|组织|升级/.test(text),
    relationshipEntry: text.includes(variables.rewardCharacter) || /盟友|负责人|资源|被救|入口|信任/.test(text),
    retentionHook: text.includes(variables.suspenseSource) || /悬念|真相|来源|下一|黑箱|秘密/.test(text)
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
      ...(copiedSurfaceRisks.length ? [`删除 ${surfaceTerms.join("、")} 等原案例表皮，换成新创意自己的${variables.scene}、${variables.crisis}和${variables.ability}。`] : []),
      `给${variables.ability}增加限制，例如只能识别局部真相、需要证据触发，不能直接知道所有答案。`,
      "每集结尾都要把一次小胜利转化为更高层压力或新疑问。",
      `让${variables.rewardCharacter}承担资源入口，同时也带来新的关系代价。`
    ],
    patternCardIds: patternIds,
    needsReview: copiedSurfaceRisks.length > 0 || covered < 4
  };
}

export const auditPatternTransfer = auditPatternTransferDemo;
