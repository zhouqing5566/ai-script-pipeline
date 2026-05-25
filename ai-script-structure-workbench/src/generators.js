import { audienceNeedTypes, hookTypes } from "./schemas.js";
import { uid } from "./seed-data.js";

const now = () => new Date().toISOString();

export function summarizeText(text = "", length = 90) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length)}...` : clean;
}

function detectEpisodeCount(text = "", fallback = 24) {
  const matches = String(text).match(/第\s*\d+\s*[集话]/g);
  if (matches?.length) return matches.length;
  return Number(fallback) || 24;
}

function inferGenre(text = "") {
  const source = String(text);
  const genres = [];
  if (/重生|前世|回到/.test(source)) genres.push("重生");
  if (/系统|面板|任务/.test(source)) genres.push("系统");
  if (/豪门|订婚|家族/.test(source)) genres.push("豪门");
  if (/复仇|清算|报仇/.test(source)) genres.push("复仇");
  if (/玄|仙|修炼/.test(source)) genres.push("玄幻");
  if (/悬疑|真相|死亡/.test(source)) genres.push("悬疑");
  return genres.length ? genres : ["都市", "逆袭", "强情绪"];
}

function inferNeeds(text = "") {
  const source = String(text);
  const needs = [];
  if (/羞辱|误解|指控|看不起|低头/.test(source)) needs.push("尊严修复");
  if (/复仇|清算|证据|真相/.test(source)) needs.push("公平清算");
  if (/重生|命运|系统|控制/.test(source)) needs.push("失控后的重新掌控");
  if (/背叛|抛弃|退婚/.test(source)) needs.push("被抛弃后的反击");
  return needs.length ? needs : audienceNeedTypes.slice(0, 3);
}

function scoreFromText(text = "", base = 72) {
  const lengthBonus = Math.min(14, Math.floor(String(text).length / 180));
  const hookBonus = /羞辱|背叛|死亡|重生|系统|危机|真相/.test(text) ? 8 : 0;
  return Math.min(96, base + lengthBonus + hookBonus);
}

function rangeForStage(stageNo, stageCount, episodeCount) {
  const start = Math.floor(((stageNo - 1) * episodeCount) / stageCount) + 1;
  const end = Math.floor((stageNo * episodeCount) / stageCount);
  return `${start}-${Math.max(start, end)}`;
}

export function analyzeScript(input = {}) {
  const text = input.text || "";
  const episodeCount = detectEpisodeCount(text, input.episodeCount);
  const genres = inferGenre(`${input.genre || ""} ${text}`);
  const needs = inferNeeds(text);
  const hook = /退婚|背叛|订婚/.test(text)
    ? "退婚/背叛开局"
    : /重生|死亡/.test(text)
      ? "死亡/重生开局"
      : hookTypes.find((item) => text.includes(item.replace("开局", ""))) || "危机开局";
  const title = input.title || "未命名剧本";
  const baseScore = scoreFromText(text);

  const stageStructure = Array.from({ length: 5 }, (_, index) => {
    const stageNo = index + 1;
    const names = ["开局钩子验证", "借势破局升级", "大反差显影", "目标重构", "终局情绪兑现"];
    return {
      stageNo,
      title: names[index],
      episodeRange: rangeForStage(stageNo, 5, episodeCount),
      stageGoal: [
        "建立羞辱与反击期待，让观众明确情绪债。",
        "用连续小胜换取入局资格，同时扩大阻碍系统。",
        "让观众发现表层复仇背后另有真相。",
        "迫使主角从单一清算转向重新选择自我。",
        "完成公开证明、关系选择和秩序重建。"
      ][index],
      mainConflict: ["公开污名 vs 证据反击", "资源压制 vs 借势翻盘", "旧认知 vs 新真相", "复仇冲动 vs 主题选择", "幕后规则 vs 自由选择"][index],
      majorTurningPoint: ["保留证据漏洞钓出幕后人", "金手指代价第一次反噬", "隐性盟友身份动摇", "主角目标从报复变为破局", "主角主动放弃操控完成主题"][index],
      emotionalFunction: ["压迫感", "爽感释放", "惊奇和不安", "痛感与重构", "最大清算和余味"][index],
      characterFunction: ["暴露主角伤口", "验证主角策略", "打破主角误判", "逼出最终选择", "完成弧光"][index],
      endingHook: ["证据还有一半在敌人手里", "胜利带出更高层敌人", "男主可能不是共犯", "能力将暴露最大秘密", "真相公开前最后反扑"]
    };
  });

  const episodes = Array.from({ length: Math.max(episodeCount, 5) }, (_, index) => {
    const episodeNo = index + 1;
    return {
      episodeNo,
      title: `第${episodeNo}集：${episodeTitle(episodeNo)}`,
      summary: `围绕${needs[0]}推进一次冲突，主角用信息差换取主动权。`,
      openingHook: episodeNo === 1 ? "公开羞辱中出现反击机会" : `上一集悬念升级为第${episodeNo}集开场压力`,
      episodeGoal: episodeNo < episodeCount * 0.4 ? "夺回叙事权" : episodeNo < episodeCount * 0.75 ? "追查深层真相" : "完成终局清算",
      mainConflict: episodeNo % 4 === 0 ? "亲密关系误判升级" : "主角证据链与反派遮掩对抗",
      keyEvent: `主角发现第${episodeNo}个可利用信息点，并选择是否立刻揭穿。`,
      coolMoment: episodeNo % 3 === 0 ? "身份或证据反打" : "用对方隐藏欲望完成反制",
      emotionalBeat: episodeNo % 5 === 0 ? "短暂脆弱暴露，人物不只是复仇机器" : `${needs[0]}的小兑现`,
      informationGain: `新增关于幕后规则的线索 ${episodeNo}`,
      characterFunction: episodeNo % 6 === 0 ? "迫使主角面对误判" : "证明主角策略和底线",
      relationshipChange: episodeNo % 4 === 0 ? "敌对关系出现裂缝" : "主角与压迫者权力位置变化",
      themeFunction: episodeNo % 5 === 0 ? "提醒主角控制他人不是最终自由" : "推进被误解后的自我证明",
      foreshadowingPlanted: [`能力代价线索 ${episodeNo}`],
      foreshadowingUsed: episodeNo > 4 ? [`第${episodeNo - 4}集埋下的证据漏洞`] : [],
      cliffhanger: episodeNo % 4 === 0 ? "一个看似敌人的人替主角挡下关键伤害" : "反派拿出更致命的反证",
      episodeFunctionType: episodeNo === 1 ? ["开局吸引", "人物暴露"] : episodeNo % 5 === 0 ? ["关系转折", "情绪沉淀"] : ["主线推进", "爽点释放"],
      weaknessNotes: episodeNo % 9 === 0 ? ["该集事件成立，但人物变化不足。"] : [],
      score: episodeNo % 9 === 0 ? 68 : 78 + (episodeNo % 7)
    };
  });

  return {
    id: uid("analysis"),
    title,
    sourceType: input.fileName ? "upload" : "paste",
    fileName: input.fileName || null,
    createdAt: now(),
    updatedAt: now(),
    rawTextRef: "browser-local-raw-text",
    normalizedTextRef: "browser-local-normalized-text",
    basicInfo: {
      title,
      genre: genres,
      subGenre: needs,
      format: input.format || "短剧",
      episodeCount,
      estimatedLength: `${episodeCount} 集，单集 1-3 分钟`,
      targetAudience: "喜欢强情绪、快节奏、清算感和反转感的短剧用户",
      platformFit: ["短视频平台", "漫剧平台", "付费短剧投流"],
      coreAppeal: "开局高压羞辱制造情绪债，中后段用主线真相反差延长观看动力。",
      commercialPositioning: "女性向强爽复仇短剧，可用强开局素材做投流切片。",
      riskNotes: ["若中段只重复打脸，主线惊奇会下降。"]
    },
    hookAnalysis: {
      openingSummary: summarizeText(text, 120) || "开场用危机建立观众问题。",
      hookTypes: [hook],
      firstSceneFunction: "快速制造压迫、误判和可反击空间。",
      firstEpisodeFunction: "让观众明确谁亏欠主角，以及主角有什么翻盘工具。",
      conflictIntroduced: "主角被公开定罪，反派掌握表层叙事权。",
      suspenseIntroduced: "主角是否拥有对方不知道的证据或记忆。",
      contrastIntroduced: "表面弱势者其实掌握隐藏信息。",
      emotionalPressure: "公开羞辱、关系背叛和身份误判叠加。",
      viewerQuestion: "她会如何在不暴露全部底牌的情况下翻盘？",
      whyContinueWatching: "观众等待第一次反击，也等待幕后真相浮出水面。",
      hookStrengthScore: baseScore,
      riskNotes: ["开头承诺强，后续必须持续还情绪债。"]
    },
    audienceNeedAnalysis: {
      primaryNeeds: needs.slice(0, 2),
      secondaryNeeds: needs.slice(2, 5),
      emotionalPromise: "被误解者不再跪着解释，而是用证据和选择夺回尊严。",
      emotionalReleaseMechanism: "每次反击都让主角获得新的信息权、关系权或资源权。",
      audiencePainPoint: "现实中被误解、被贴标签或被亲密关系否定时缺少申辩机会。",
      fantasyCompensation: "故事提供公开证明、反向审判和命运重写。",
      satisfactionPath: "羞辱压迫 -> 隐忍取证 -> 小爽点反打 -> 真相升级 -> 终局清算。",
      emotionalNeedScore: baseScore - 2,
      riskNotes: ["爽点需要服务尊严修复，不宜只做围观震惊。"]
    },
    themeAnalysis: {
      themeStatement: "真正的自由不是掌控每个人，而是在看清真相后仍能选择成为谁。",
      deepTheme: "复仇可以夺回话语权，但不能让主角再次被仇恨定义。",
      antiThemeForce: "家族、系统或舆论把人的价值变成可操控标签。",
      themeCarrierCharacters: ["主角", "表面敌对的隐性同盟", "继妹/反派"],
      themeConflict: "用控制换安全，还是用选择承担代价。",
      howThemeIsExpressed: "通过金手指代价、误判关系和终局选择表达。",
      themePayoff: "主角公开真相后放弃继续操控他人，让关键人物自由选择立场。",
      themeStrengthScore: baseScore - 6,
      riskNotes: ["如果人物没有最终选择，主题会变成口号。"]
    },
    mainlineStructure: {
      protagonistStartPoint: "被公开误解、资源和关系都处于低位。",
      protagonistGoal: "先夺回清白和主动权，再追查前世悲剧真相。",
      centralConflict: "主角追求真相与自由选择，反派维护既有叙事和控制规则。",
      drivingQuestion: "主角能否在不被仇恨吞没的情况下改写命运？",
      stageStructure,
      escalationLogic: "每次胜利都会暴露更深层敌人和更高代价。",
      midpointChange: "中段发现表层仇人只是棋子，主角目标从复仇转向破除命运规则。",
      finalConflict: "公开真相与保住最后秘密之间的选择。",
      mainlineStrengthScore: baseScore - 4,
      riskNotes: ["必须提前埋下幕后规则线索。"]
    },
    mainlineReversalAnalysis: {
      hasMainlineReversal: true,
      title: "表面共犯其实一直在阻止更大献祭",
      surfaceStory: "观众以为男主或关键盟友是前世悲剧共犯。",
      deepTruth: "他看似阻止主角复仇，实际上在避免她触发更深层命运代价。",
      reversalTypes: ["爱情真相反差", "敌人立场反差", "金手指本质反差"],
      revealTiming: "中段给裂缝，终局前揭完整真相。",
      foreshadowingBeforeReveal: ["多次阻止能力使用", "关键现场有第三方痕迹", "反派害怕两人接近"],
      impactAfterReveal: "主角目标从清算个体升级为破除规则。",
      characterImpact: "主角必须承认自己也可能误判他人。",
      themeConnection: "反差迫使主题从复仇爽升级为自由选择。",
      reversalStrengthScore: baseScore - 1,
      riskNotes: ["洗白要有边界，不能抵消前期情绪债。"]
    },
    endingAnalysis: {
      endingSummary: "主角公开真相，清算幕后者，同时放弃继续用能力操控他人。",
      protagonistFinalState: "从复仇者变成能够选择自我的人。",
      antagonistFinalState: "失去叙事权和资源控制权。",
      relationshipFinalState: "误判关系完成重新选择，而非简单原谅。",
      worldFinalState: "被遮蔽的旧案公开，新的秩序建立。",
      themePayoff: "自由选择高于控制。",
      emotionalPayoff: "尊严修复、公平清算、被误解后的证明。",
      promisedEmotionReturned: true,
      unresolvedIssues: ["后续可保留能力消失后的生活余味"],
      endingStrengthScore: baseScore - 3,
      riskNotes: ["结局必须回收开局羞辱和母亲真相两条承诺。"]
    },
    characterAnalysis: {
      protagonist: makeCharacter("林照", "女主", "从被污名者到自我选择者"),
      mainCharacters: [
        makeCharacter("沈砚", "表面阻碍者 / 隐性同盟", "从冷酷守密到共同承担真相"),
        makeCharacter("林晚", "继妹 / 表层反派", "用伪装的弱者身份夺取同情"),
        makeCharacter("林父", "家族权威", "把亲情当成资源秩序的一部分")
      ],
      relationshipEdges: [
        {
          from: "林照",
          to: "沈砚",
          initialRelation: "前世共犯嫌疑",
          hiddenRelation: "曾试图阻止献祭规则",
          desireTowardOther: "确认对方真实立场",
          conflict: "一个要追查，一个要阻止能力失控",
          emotionalDebt: "前世死亡现场的误解",
          relationshipShift: "敌对试探 -> 被迫合作 -> 共同选择",
          finalState: "不靠控制维持信任",
          themeFunction: "承载自由选择主题"
        }
      ],
      characterSystemSummary: "人物系统围绕叙事权、亲密误判和选择代价展开。",
      characterStrengthScore: baseScore - 5,
      riskNotes: ["反派需要有自保逻辑，不能只负责被打脸。"]
    },
    goldfingerAnalysis: {
      hasGoldfinger: /系统|面板|能力|看见/.test(text),
      name: "隐藏欲望视窗",
      type: "好感度面板 / 欲望识别",
      visibleFunction: "看见他人最强欲望和恐惧，用于取证和反制。",
      hiddenNature: "每次使用都会暴露主角一个秘密，反过来考验她对控制的依赖。",
      rules: ["只能看到当下强烈欲望", "无法直接判断事实真假", "对真诚表达者信息最少"],
      limits: ["连续使用会误读", "无法解决情感选择"],
      costs: ["秘密暴露", "信任关系受损", "反派可诱导错误欲望"],
      upgradePath: ["看见欲望", "看见恐惧", "看见代价", "最终放弃使用"],
      coolUses: ["公开反打", "识破伪证", "逼反派自曝", "用误导欲望反设局"],
      misuseRisks: ["主角用能力替代沟通，人物弧光停滞"],
      relationshipToTheme: "金手指把控制感和自由选择的矛盾具象化。",
      relationshipToCharacterArc: "主角越依赖能力，越需要面对自己真正害怕的东西。",
      goldfingerStrengthScore: baseScore - 7,
      riskNotes: ["必须保留限制和代价，否则冲突会被能力抹平。"]
    },
    obstacleAnalysis: {
      obstacleTypes: ["舆论定罪", "家族资源压制", "伪证链", "能力代价", "亲密关系误判"],
      obstacleEscalation: "从个人污名升级为家族旧案和命运规则。",
      antagonistSystem: "表层反派制造污名，幕后者维护规则，旁观者提供舆论压力。",
      whyCannotBeSolvedAtOnce: "证据链被分散，金手指只能看到欲望，不能直接还原事实。",
      pressureMechanism: "每次反击都会暴露一个秘密或引出更高层敌人。",
      obstacleStrengthScore: baseScore - 4,
      riskNotes: ["如果证据太容易获得，长线动力会不足。"]
    },
    episodeFunctionAnalysis: episodes,
    reusablePatterns: makeReusablePatterns(title, needs, genres),
    classificationTags: {
      genre: genres,
      audienceNeeds: needs,
      hookTypes: [hook],
      goldfingerTypes: ["好感度面板", "重生记忆"],
      mainlineReversalTypes: ["爱情真相反差", "敌人立场反差"],
      rhythmTypes: ["24 集强钩子短剧节奏"]
    },
    qualityNotes: {
      strengths: ["开局压力明确", "情绪承诺清楚", "金手指有代价", "中段有主线大反差空间"],
      weaknesses: ["需要强化中段伏笔密度", "反派系统需要避免工具化"],
      suggestedRepairs: ["在第 3-5 集加入能力代价伏笔", "让表层反派每次行动都服务幕后规则"]
    },
    analystNotes: "Demo 分析基于结构规则生成，真实生产建议接入模型后由主编复核。",
    confidence: 0.78
  };
}

function makeCharacter(name, role, arcSummary) {
  return {
    name,
    role,
    archetype: role.includes("反派") ? "伪装受害者" : "受伤的控制者",
    surfaceDesire: "赢回眼前局面",
    innerLack: "缺少不被外界叙事定义的安全感",
    misbelief: "只要掌控信息，就能避免再次受伤",
    fear: "再次被亲密关系背叛",
    wound: "前世或过去被公开否定",
    temptation: "用能力或权力控制他人选择",
    mask: "冷静、强硬、无懈可击",
    motivation: "夺回尊严并查清真相",
    conflictWithProtagonist: role === "女主" ? "自我冲突" : "围绕真相、信任和控制权发生冲突",
    relationshipToTheme: "用选择与控制的矛盾承载主题",
    relationshipToMainlineReversal: "在中段反差后重新定义立场",
    turningPoints: ["开局受压", "第一次反击", "中段误判被打破", "终局完成选择"],
    finalChoice: "不再让恐惧替自己做决定",
    arcSummary,
    riskNotes: ["需要用具体场景呈现，不宜只写设定。"]
  };
}

function makeReusablePatterns(title, needs, genres) {
  return [
    {
      id: uid("pattern"),
      sourceScriptId: "current-analysis",
      patternType: "开头钩子模式",
      title: "公开羞辱中的隐藏信息反打",
      description: "在公开羞辱场景中让主角获得只有自己能看见的信息，建立低位反打期待。",
      applicableGenres: genres,
      applicableAudienceNeeds: needs,
      structureTemplate: "公开定罪 -> 主角看见漏洞 -> 暂不全盘反击 -> 留钩子钓出幕后者",
      whyItWorks: "同时满足尊严修复和悬念追看。",
      risks: ["如果主角不反击太久，会变成憋屈。"],
      exampleEpisodes: [1, 2],
      confidence: 0.82
    },
    {
      id: uid("pattern"),
      sourceScriptId: "current-analysis",
      patternType: "主线大反差模式",
      title: "表面共犯其实阻止更大代价",
      description: `${title} 可以用关系误判支撑中后段惊奇。`,
      applicableGenres: genres,
      applicableAudienceNeeds: needs,
      structureTemplate: "前期敌对 -> 多处不合常理保护 -> 中段裂缝 -> 终局真相",
      whyItWorks: "把单线复仇升级为人物选择和主题兑现。",
      risks: ["需要足够伏笔避免强行洗白。"],
      exampleEpisodes: [4, 12, 20],
      confidence: 0.76
    }
  ];
}

function episodeTitle(no) {
  const titles = ["订婚宴反证", "大屏证据", "秘密代价", "冷面阻止", "旧案照片", "第一次合作"];
  return titles[(no - 1) % titles.length];
}

export function evaluateIdea(project) {
  const idea = project.creativeInput || "";
  const needs = inferNeeds(idea);
  const genres = inferGenre(idea);
  return {
    logline: summarizeText(idea, 120),
    coreHook: "重生者在公开背叛现场获得隐藏欲望能力，必须边清算边避免被能力反噬。",
    coreContrast: "最想掌控命运的人，最终必须学会放弃控制。",
    coreSuspense: "前世害死她的人到底是谁，男主为何阻止她复仇？",
    coreConflict: "女主夺回叙事权，幕后者维护命运规则和家族利益。",
    potentialAudienceNeeds: needs,
    genreFit: genres,
    styleFit: ["强爽短剧", "情绪悬疑", "重生复仇", "漫剧改编"],
    goldfingerPotential: "强。能力既能制造爽点，也天然携带代价和主题矛盾。",
    mainlineReversalPotential: "强。男主立场、母亲旧案和能力本质都可形成中后段反差。",
    longFormPotential: "中高。若只做清算容易疲劳，加入旧案真相后可支撑 24-36 集。",
    commercialPotentialScore: scoreFromText(idea, 76),
    noveltyScore: 78,
    executionDifficultyScore: 68,
    risks: ["前期复仇和后期真相需要同一条证据链", "金手指代价必须稳定"],
    suggestions: ["锁定主题为自由选择", "让男主阻止复仇的动机提前露出异常", "每 4 集安排一次关系或真相升级"]
  };
}

export function generateDirections(project) {
  const needs = inferNeeds(project.creativeInput);
  const shared = {
    audienceNeeds: needs,
    mainCharactersPreview: ["重生女主", "表面冷酷的隐性同盟", "伪装受害者的继妹", "维护旧秩序的家族权威"],
    goldfingerPreview: "看见隐藏欲望，但每次使用都会暴露主角秘密。",
    risks: ["中段需要避免机械打脸", "能力规则要保持一致"]
  };
  const configs = [
    ["稳妥商业版", "强清算复仇", 88, 73, 84, 72, 58],
    ["强爽高刺激版", "密集反打爽点", 91, 70, 92, 64, 62],
    ["主线惊艳反套路版", "表面共犯与命运规则反差", 84, 89, 86, 84, 70],
    ["情感宿命版", "误判关系与自由选择", 80, 82, 88, 88, 66],
    ["黑化高压冲突版", "主角差点成为新的操控者", 83, 86, 94, 82, 74]
  ];
  return configs.map(([type, appeal, commercial, freshness, emotion, depth, difficulty], index) => ({
    id: uid("direction"),
    title: `${type}：${appeal}`,
    type,
    logline:
      index === 2
        ? "她以为重生是为了复仇，直到发现前世的仇人只是阻止她被命运献祭的失败者。"
        : "她重生回到公开背叛当晚，用能看见隐藏欲望的能力夺回清白，却一步步查到更深的旧案。",
    mainAppeal: appeal,
    themeStatement: index === 4 ? "当受害者掌握权力，最难的是不成为新的加害者。" : "真正的自由不是控制命运，而是看清真相后仍能选择自己。",
    coreConflict: "夺回叙事权与避免被仇恨操控之间的冲突。",
    mainlineReversalPreview: index === 2 ? "男主不是共犯，金手指也不是奖励，而是命运规则的诱饵。" : "母亲旧案背后有更高层操盘者。",
    endingPreview: "主角公开真相，完成清算，但选择放弃继续用能力操控他人。",
    commercialPotentialScore: commercial,
    freshnessScore: freshness,
    emotionalIntensityScore: emotion,
    characterDepthScore: depth,
    productionDifficultyScore: difficulty,
    recommendation: index === 2 ? "推荐：商业稳态和惊奇度最好平衡。" : "可作为局部风格强化方向。",
    ...shared
  }));
}

export function generateThemeCandidates(project) {
  return [
    {
      id: uid("theme"),
      audienceNeed: "尊严修复",
      audienceNeedTypes: ["尊严修复", "公平清算", "被误解后的证明"],
      emotionalPromise: "被公开误解的人最终获得公开证明。",
      themeStatement: "真正的自由不是掌控每个人，而是在看清真相后仍能选择成为谁。",
      antiThemeForce: "家族和舆论把人压成标签，系统把情感变成可操控数据。",
      emotionalPayoff: "清白归位，压迫者失去叙事权，主角不再自证给所有人看。",
      characterImplication: "主角必须从复仇者成长为能承担选择代价的人。",
      plotImplication: "每次爽点都要改变信息权或关系权，而不是只让围观者震惊。",
      risks: ["如果结局只是打倒反派，主题会偏浅。"],
      score: 91
    },
    {
      id: uid("theme"),
      audienceNeed: "失控后的重新掌控",
      audienceNeedTypes: ["控制感补偿", "命运反抗", "自由幻想"],
      emotionalPromise: "被命运推着走的人反过来改写规则。",
      themeStatement: "命运可以被看见，但不能替人完成选择。",
      antiThemeForce: "幕后系统试图用可预测剧情锁死每个人的命运。",
      emotionalPayoff: "主角破除规则，让所有关键人物重新拥有选择权。",
      characterImplication: "主角必须承认控制感不是安全感。",
      plotImplication: "金手指从爽点工具升级为主题矛盾。",
      risks: ["世界观解释过重会拖慢短剧节奏。"],
      score: 87
    },
    {
      id: uid("theme"),
      audienceNeed: "被抛弃后的反击",
      audienceNeedTypes: ["被抛弃后的反击", "极致偏爱", "复仇释放"],
      emotionalPromise: "被背叛者重新获得被坚定选择的资格。",
      themeStatement: "爱不是站在胜利者一边，而是在代价面前仍然选择真实。",
      antiThemeForce: "利益关系伪装成爱，亲密关系变成可交易筹码。",
      emotionalPayoff: "误判关系被重新证明，伪爱被清算。",
      characterImplication: "主角要重新学习信任，而不是只靠证据活着。",
      plotImplication: "关系线需要承担更多关键节点。",
      risks: ["容易从复仇爽偏成恋爱甜虐。"],
      score: 82
    }
  ];
}

export function generateMainlineReversals(project) {
  const theme = project.lockedTheme?.themeStatement || "真正的自由不是控制命运";
  return [
    {
      id: uid("reversal"),
      title: "表面共犯其实在阻止更大献祭",
      surfaceStory: "观众以为男主前世害死女主，是她复仇名单上的关键敌人。",
      deepTruth: "男主前世试图阻止幕后规则锁定女主，但失败后被剪成共犯。",
      reversalTypes: ["爱情真相反差", "敌人立场反差"],
      themeConnection: `迫使主角理解：${theme}。`,
      characterImpact: "女主必须面对自己的误判，男主也必须停止替她做决定。",
      foreshadowingPlan: {
        early: ["男主阻止她使用能力", "男主知道前世细节却不解释"],
        middle: ["反派害怕两人合作", "旧案证据出现第三方篡改痕迹"],
        late: ["男主承认自己曾试图牺牲名誉换她活下来"]
      },
      revealPlan: {
        firstReveal: "第 10-12 集发现男主不是最大受益者。",
        midReveal: "第 16-18 集确认前世死亡现场被第三方操控。",
        finalReveal: "终局前男主说出自己阻止失败的真相。"
      },
      impactOnPlot: "目标从清算男主转为追查幕后规则。",
      impactOnGoldfinger: "能力不再是奖励，而是幕后规则投放的诱饵。",
      impactOnRelationships: "敌对试探转为带刺合作。",
      impactOnEnding: "结局不是原谅，而是共同公开真相并重新选择。",
      payoff: "既保留前期误判张力，又让中后段有惊奇。",
      freshnessScore: 90,
      rationalityScore: 84,
      emotionalScore: 88,
      risks: ["需要控制男主前期伤害边界。"]
    },
    {
      id: uid("reversal"),
      title: "金手指不是补偿，而是命运规则的诱饵",
      surfaceStory: "重生后获得能力是命运给主角的补偿。",
      deepTruth: "能力通过不断暴露秘密，诱导主角成为新的操控者。",
      reversalTypes: ["金手指本质反差", "胜利条件反差"],
      themeConnection: "把控制感和自由选择的主题冲突具体化。",
      characterImpact: "主角越赢越危险，必须放弃最依赖的工具。",
      foreshadowingPlan: {
        early: ["能力每次使用都有微小代价"],
        middle: ["反派能预判她会依赖能力"],
        late: ["能力要求她交换最核心的秘密"]
      },
      revealPlan: {
        firstReveal: "第 8 集发现能力信息并不完整。",
        midReveal: "第 15 集发现能力会放大她的控制欲。",
        finalReveal: "终局前能力要求她用他人选择换胜利。"
      },
      impactOnPlot: "爽点从使用能力转为摆脱能力。",
      impactOnGoldfinger: "限制、代价和终局选择形成完整闭环。",
      impactOnRelationships: "主角必须恢复真实沟通。",
      impactOnEnding: "放弃能力成为主题兑现。",
      payoff: "让金手指有主题价值，不只是外挂。",
      freshnessScore: 87,
      rationalityScore: 88,
      emotionalScore: 84,
      risks: ["解释太玄会降低短剧清晰度。"]
    },
    {
      id: uid("reversal"),
      title: "母亲死亡不是商业谋害，而是一次失败的命运改写",
      surfaceStory: "母亲死于家族夺权和商业陷害。",
      deepTruth: "母亲曾经也拥有类似能力，并试图让女儿摆脱规则。",
      reversalTypes: ["世界观反差", "目标反差", "结局反差"],
      themeConnection: "上一代失败的选择让主角必须完成新的选择。",
      characterImpact: "主角从替母报仇转为理解母亲留下的自由意志。",
      foreshadowingPlan: {
        early: ["母亲旧物与能力规则呼应"],
        middle: ["母亲旧案中出现无法解释的证词空白"],
        late: ["母亲留下给女主的反能力提示"]
      },
      revealPlan: {
        firstReveal: "第 9 集发现母亲不是单纯受害者。",
        midReveal: "第 17 集发现母亲曾主动设局保护女儿。",
        finalReveal: "终局前母亲留下的选择题被打开。"
      },
      impactOnPlot: "个人复仇升级为代际命运破局。",
      impactOnGoldfinger: "能力来源与母亲旧案相连。",
      impactOnRelationships: "主角重新理解父辈和盟友的行为。",
      impactOnEnding: "主角完成母亲未完成的选择，而不是重复牺牲。",
      payoff: "提高故事厚度和余味。",
      freshnessScore: 84,
      rationalityScore: 80,
      emotionalScore: 91,
      risks: ["代际线需要简洁表达，避免信息过载。"]
    }
  ];
}

export function generateEndings(project) {
  return [
    {
      id: uid("ending"),
      title: "公开真相，放弃控制",
      finalSituation: "女主在终局发布会上公开母亲旧案和反派操控证据。",
      protagonistFinalChoice: "她可以用能力让所有人按她预期站队，但选择公开证据后让关键人物自行选择。",
      antagonistFinalState: "失去叙事权、资源权和道德伪装。",
      keyCharactersFinalState: ["男主不再替她做决定", "继妹被迫面对真实欲望", "家族权威被公开审判"],
      worldFinalChange: "旧案被重启，家族资源秩序被改写。",
      themePayoff: "自由选择高于控制。",
      emotionalPayoff: "最大尊严修复和公平清算。",
      reversalPayoff: "男主立场、能力本质和母亲旧案全部回收。",
      cost: "女主失去能力，也失去继续轻易掌控局面的捷径。",
      aftertaste: "她第一次不用证明自己，也能继续往前走。",
      risks: ["终局证据链必须提前铺好。"],
      score: 92
    },
    {
      id: uid("ending"),
      title: "以身入局，反向献祭规则",
      finalSituation: "女主假装接受命运规则，用自己的最后秘密换出幕后者真名。",
      protagonistFinalChoice: "她愿意承担名誉风险，但不再牺牲他人选择。",
      antagonistFinalState: "被自己的规则反噬。",
      keyCharactersFinalState: ["男主公开站队", "反派同盟瓦解"],
      worldFinalChange: "规则被曝光但仍留有余波。",
      themePayoff: "控制命运的规则败给主动选择。",
      emotionalPayoff: "高压危机后的翻盘释放。",
      reversalPayoff: "金手指诱饵被反向利用。",
      cost: "女主必须公开一个最痛秘密。",
      aftertaste: "强刺激，适合留续作口。",
      risks: ["处理不好会显得故弄玄虚。"],
      score: 86
    },
    {
      id: uid("ending"),
      title: "不再复仇，交给公开审判",
      finalSituation: "女主拿到最终证据后，没有私刑报复，而是让全社会看见真相。",
      protagonistFinalChoice: "她选择停止复仇链条。",
      antagonistFinalState: "被法律和舆论双重清算。",
      keyCharactersFinalState: ["重要关系完成和解但不回到过去"],
      worldFinalChange: "被压下的旧案成为行业级震动。",
      themePayoff: "尊严不是赢过所有人，而是不再被他们定义。",
      emotionalPayoff: "克制但有余味的尊严修复。",
      reversalPayoff: "母亲旧案成为最终公开证据。",
      cost: "爽感不如强反杀结局直接。",
      aftertaste: "更成熟，更适合主编审美。",
      risks: ["短剧用户可能觉得清算不够狠。"],
      score: 81
    }
  ];
}

export function generateMajorNodes(project) {
  const episodeCount = project.creativeConstraints.episodeCount || 24;
  const nodes = [
    ["开局节点", "第1集", "公开羞辱与隐藏欲望能力觉醒", "建立情绪债和金手指规则"],
    ["第一次大爽点", "第3-4集", "女主用证据反制继妹，但故意留下漏洞", "证明主角有策略，不只是开挂"],
    ["第一次关系转折", "第6-8集", "男主看似阻止复仇，却替她挡下一次能力反噬", "让敌对关系出现裂缝"],
    ["中段大揭示", `第${Math.floor(episodeCount * 0.55)}集`, "发现前世共犯叙事被剪辑过", "主线大反差显影"],
    ["主角目标重构", `第${Math.floor(episodeCount * 0.7)}集`, "复仇目标升级为破除母亲旧案背后的规则", "主题从清算升级为自由选择"],
    ["终局前最大危机", `第${episodeCount - 2}集`, "能力要求女主交出最后秘密换取胜利", "逼出最终选择"],
    ["最终结局", `第${episodeCount}集`, "公开真相，清算幕后者，女主放弃继续控制", "兑现情绪与主题"]
  ].map(([title, range, keyEvent, fn], index) => ({
    nodeNo: index + 1,
    suggestedEpisodeRange: range,
    title,
    function: fn,
    keyEvent,
    characterChange: index < 3 ? "主角从被动反击到主动布局" : index < 6 ? "主角承认误判并重构目标" : "主角完成最终选择",
    relationshipChange: index === 2 ? "敌对关系出现信任裂缝" : index === 3 ? "表面敌人转入合作可能" : "关系随真相重新站队",
    reversalProgress: index < 2 ? "埋伏笔" : index < 5 ? "逐步显影" : "完整揭示并兑现",
    emotionalFunction: index < 2 ? "压迫后反打" : index < 5 ? "惊奇与痛感" : "终局释放",
    nextHook: index === 6 ? "故事闭环" : "新的证据指向更高层敌人"
  }));
  return [
    {
      id: uid("nodes"),
      title: "24 集强钩子五阶段节点计划",
      nodes
    }
  ];
}

export function generateMacroOutline(project) {
  const direction = project.selectedDirection || project.directionCandidates[0] || {};
  const theme = project.lockedTheme || project.themeCandidates[0] || {};
  const reversal = project.lockedMainlineReversal || project.mainlineReversalCandidates[0] || {};
  const ending = project.lockedEnding || project.endingCandidates[0] || {};
  return {
    title: project.title,
    logline: direction.logline || summarizeText(project.creativeInput, 120),
    genre: ["都市", "重生", "复仇", "悬疑情感"],
    audienceNeeds: theme.audienceNeedTypes || ["尊严修复", "公平清算"],
    themeStatement: theme.themeStatement || "真正的自由不是控制命运，而是重新选择自己。",
    mainlineReversal: reversal.title || "表面共犯其实阻止更大献祭",
    ending: ending.title || "公开真相，放弃控制",
    protagonistArc: "从被公开定罪的复仇者，到能放弃控制、完成自由选择的人。",
    goldfingerDesign: generateGoldfinger(project),
    storyEngine: generateStoryEngine(project),
    characterCore: generateCharacterCore(project),
    relationshipWeb: {
      summary: "关系网围绕误判、隐性保护、叙事权争夺和最终重新选择展开。",
      edges: [
        "女主 - 男主：敌对试探到共同选择",
        "女主 - 继妹：身份叙事权争夺",
        "女主 - 家族：亲情资源化的清算"
      ]
    },
    materialPools: generateMaterialPools(project),
    stageOutline: generateStageOutline(project)
  };
}

export function generateCharacterCore(project) {
  return {
    protagonist: {
      id: "char-protagonist",
      name: "林照",
      role: "女主",
      surfaceDesire: "洗清污名并清算前世仇人",
      innerLack: "无法相信自己不掌控一切也能安全",
      misbelief: "只要看穿所有人的欲望，就不会再次受伤",
      fear: "被亲密关系再次背叛",
      wound: "前世在公开误解和亲人背叛中死去",
      temptation: "用能力操控每个人的选择",
      mask: "冷静、锋利、永远留后手",
      motivation: "夺回尊严，查清母亲死亡真相",
      relationshipToTheme: "她的成长就是从控制到选择。",
      relationshipToReversal: "她必须承认前世认知可能被剪辑。",
      turningPoints: ["订婚宴反击", "能力反噬", "男主立场裂缝", "母亲旧案揭示", "终局放弃能力"],
      finalChoice: "公开真相后不再用能力左右他人。",
      arcSummary: "从复仇驱动到自由选择。",
      risks: ["不能只强不痛，否则人物单薄。"]
    },
    mainCharacters: [
      {
        id: "char-shenyan",
        name: "沈砚",
        role: "表面阻碍者 / 隐性同盟",
        surfaceDesire: "阻止林照触发能力代价",
        innerLack: "以为替别人做决定就是保护",
        misbelief: "真相会把她再次推向死亡",
        fear: "重复前世失败",
        wound: "曾经没能救下她",
        temptation: "继续隐瞒一切",
        mask: "冷酷、克制、像敌人",
        motivation: "阻止幕后规则吞掉女主",
        relationshipToTheme: "他也要学会尊重选择。",
        relationshipToReversal: "承担主线大反差的核心人物。",
        turningPoints: ["阻止追查", "替她挡代价", "承认真相一角", "公开站队"],
        finalChoice: "不再替她决定，而是并肩承担。",
        arcSummary: "从替人选择到共同选择。",
        risks: ["前期伤害边界要清楚。"]
      },
      {
        id: "char-linwan",
        name: "林晚",
        role: "继妹 / 表层反派",
        surfaceDesire: "夺取林照的身份、资源和同情",
        innerLack: "相信只有取代别人才能被爱",
        misbelief: "只要掌握舆论，真相就不重要",
        fear: "真实自己无人选择",
        wound: "长期以外来者身份自卑",
        temptation: "继续扮演受害者",
        mask: "柔弱、无辜、被欺负",
        motivation: "保住偷来的身份",
        relationshipToTheme: "她是反主题力量的小型化。",
        relationshipToReversal: "她知道部分真相但误以为能控制全局。",
        turningPoints: ["订婚宴诬陷", "证据链被撕开", "被幕后者抛弃", "最终自曝"],
        finalChoice: "继续否认，最终被自己的欲望出卖。",
        arcSummary: "从伪装受害者到真实欲望曝光。",
        risks: ["不能只坏，要有自保动机。"]
      }
    ],
    relationshipWebSummary: "人物关系不是装饰，每条关系都推动主题、大反差或清算节奏。"
  };
}

export function generateGoldfinger() {
  return {
    name: "隐藏欲望视窗",
    type: "好感度面板 / 欲望识别",
    visibleFunction: "看见对方当前最强欲望、恐惧或隐瞒倾向。",
    hiddenNature: "能力会用主角自己的秘密作为交换，诱导她更依赖控制。",
    rules: ["只显示强烈欲望，不显示完整事实", "越亲近的人越难读准", "同一场景最多使用一次"],
    limits: ["无法替代证据", "无法判断对方最终选择", "会被反派用假欲望误导"],
    costs: ["暴露主角秘密", "消耗信任", "强化控制欲"],
    upgradePath: ["欲望词条", "恐惧词条", "代价词条", "终局放弃能力"],
    coolUses: ["识破伪证", "反向设局", "让反派自曝", "在公开场合翻转叙事"],
    misuseRisks: ["把所有关系变成计算", "主角失去真实沟通能力"],
    relationshipToTheme: "金手指是控制感的实体化。",
    relationshipToCharacterArc: "主角越依赖它，越需要学会放手。",
    relationshipToMainlineReversal: "后期揭示它是命运规则诱饵。",
    risks: ["必须有代价和误读，否则无敌。"]
  };
}

export function generateStoryEngine(project) {
  return {
    protagonistGoal: "洗清污名、夺回主动权、查清母亲死亡真相。",
    antagonistGoal: "维护伪证链和家族旧秩序，阻止女主接近幕后规则。",
    centralConflict: "真相公开与叙事操控的冲突。",
    drivingQuestion: "女主能否在不用控制他人选择的前提下改写命运？",
    whyCannotStop: "停止追查就会再次被旧叙事吞没，母亲旧案也会永远封存。",
    whyGoldfingerCannotSolveEverything: "能力只能看到欲望，不能证明事实，而且每次使用都有代价。",
    escalationLogic: "小胜暴露更深线索，更深线索引出更高层敌人。",
    stageGoals: ["反证开局", "夺回资源", "揭开误判", "重构目标", "公开清算"],
    obstacleSystem: ["舆论污名", "家族资源", "伪证链", "能力代价", "亲密关系误判"],
    stakesEscalation: ["名誉", "资源", "关系", "母亲旧案", "自由选择"],
    postReversalGoalChange: "从清算个人转为破除操控命运的规则。",
    risks: ["每次胜利必须带来更大问题。"]
  };
}

export function generateMaterialPools() {
  const make = (type, title, description, stage) => ({
    id: uid("material"),
    title,
    description,
    type,
    audienceNeedServed: "尊严修复 / 公平清算",
    characterFunction: "推进主角从控制到选择",
    themeFunction: "验证自由选择主题",
    relatedCharacters: ["林照", "沈砚", "林晚"],
    relatedReversal: "表面共犯其实阻止更大献祭",
    suggestedStage: stage,
    risks: ["使用时必须连接证据链。"]
  });
  return {
    hooks: [
      make("开头钩子", "公开道歉倒计时", "全场逼主角道歉，屏幕倒计时即将播放伪证。", "第一阶段"),
      make("开头钩子", "秘密交换提示", "能力提示：使用一次，将有一个秘密被听见。", "第二阶段")
    ],
    coolMoments: [
      make("爽点", "反向公开证据", "主角用反派自己隐藏的欲望引导其自曝。", "第一阶段"),
      make("爽点", "低位资源反夺", "主角拿回母亲项目，现场反打家族权威。", "第二阶段")
    ],
    reversals: [
      make("反转", "男主不是最大受益者", "证据显示男主曾破坏反派计划。", "第三阶段"),
      make("反转", "能力来源有旧案痕迹", "母亲遗物中出现同样的能力代价记录。", "第四阶段")
    ],
    cliffhangers: [
      make("结尾悬念", "谁听见了她的秘密", "能力代价触发，但画面只给出一个背影。", "第二阶段"),
      make("结尾悬念", "前世死亡视频缺失 17 秒", "关键视频出现无法解释的空白。", "第三阶段")
    ],
    emotionalBeats: [
      make("情绪节拍", "第一次承认害怕", "主角在胜利后承认自己仍怕重蹈覆辙。", "第三阶段"),
      make("情绪节拍", "不再自证", "终局前主角停止向不值得的人解释。", "第五阶段")
    ],
    foreshadowing: [
      make("伏笔", "母亲旧笔记的空白页", "空白页在能力触发时显字。", "第一阶段"),
      make("伏笔", "男主反复看向她的左手", "后期揭示左手伤痕是前世能力反噬痕迹。", "第二阶段")
    ]
  };
}

export function generateStageOutline(project) {
  const episodeCount = project.creativeConstraints.episodeCount || 24;
  const titles = ["开局验证钩子与金手指", "借势破局，卷入更大冲突", "主线大反差开始显影", "真相揭开，人物目标重构", "终局清算，主题与情绪兑现"];
  return titles.map((title, index) => {
    const stageNo = index + 1;
    return {
      stageNo,
      title,
      episodeRange: rangeForStage(stageNo, 5, episodeCount),
      stageGoal: ["建立情绪债和反击工具", "让主角通过小胜进入更大局", "让表面认知出现裂缝", "让主角承认目标需要改变", "完成公开真相和自由选择"][index],
      majorConflict: ["公开污名 vs 反证", "资源封锁 vs 借势夺回", "复仇判断 vs 新证据", "控制诱惑 vs 真实选择", "幕后规则 vs 公开真相"][index],
      reversalProgress: ["埋下异常", "制造矛盾", "第一次显影", "完整揭示", "终局兑现"][index],
      characterProgress: ["从受压到反击", "从反击到布局", "从自信到动摇", "从误判到重构", "从控制到选择"][index],
      relationshipProgress: ["敌我清晰", "敌对裂缝", "被迫合作", "信任试炼", "重新选择"][index],
      themeProgress: ["提出控制与自由的矛盾", "让控制带来代价", "打破复仇单一目标", "逼出主题选择", "完成主题兑现"][index],
      keyEvents: ["订婚宴反证", "夺回母亲项目", "发现前世视频缺口", "母亲旧案真相显影", "终局发布会公开证据"].slice(index, index + 2),
      keyCoolMoments: ["大屏反证", "身份反打", "反向设局", "能力诱饵反用", "公开清算"].slice(index, index + 2),
      keyForeshadowing: [`第${stageNo}阶段能力代价线索`, `第${stageNo}阶段关系误判线索`],
      endingHook: ["真正操盘者第一次露面", "男主知道前世细节", "母亲旧案不是商业谋害", "能力要求交出最后秘密", "故事闭环"][index],
      risks: index === 2 ? ["中段必须避免只打脸不揭示。"] : ["保持每集信息增量。"]
    };
  });
}

export function generateEpisodeOutline(project) {
  const episodeCount = project.creativeConstraints.episodeCount || 24;
  const stageCount = project.creativeConstraints.stageCount || 5;
  const lockedTheme = project.lockedTheme?.themeStatement || project.macroOutline?.themeStatement || "自由选择高于控制";
  return Array.from({ length: episodeCount }, (_, index) => {
    const episodeNo = index + 1;
    const stageNo = Math.min(stageCount, Math.floor((index / episodeCount) * stageCount) + 1);
    const weak = episodeNo % 9 === 0;
    return {
      episodeNo,
      title: `第${episodeNo}集：${episodeTitle(episodeNo)}`,
      stageNo,
      openingHook: episodeNo === 1 ? "订婚宴公开倒计时，所有人逼她认罪。" : `承接上一集反证，新的秘密代价出现。`,
      episodeGoal: stageNo < 3 ? "夺回叙事权并扩大证据链" : stageNo < 5 ? "验证主线大反差并重构目标" : "完成终局清算",
      conflict: weak ? "反派挑衅，主角反打，众人震惊。" : "主角想公开证据，反派用更高层资源压回舆论。",
      keyEvent: weak ? "主角在宴会上反打反派。" : `主角发现第${episodeNo}条证据与母亲旧案有关。`,
      goldfingerUse: episodeNo % 4 === 0 ? "能力被诱导误读，制造代价。" : "看见对方隐藏欲望，找到证据漏洞。",
      coolMoment: episodeNo % 3 === 0 ? "公开反向审判，让反派亲口承认漏洞。" : "低位角色用信息差完成反制。",
      emotionalBeat: weak ? "爽点释放但人物痛感不足。" : episodeNo % 5 === 0 ? "主角短暂承认自己害怕重复前世。" : "尊严修复小兑现。",
      plotTwist: episodeNo % 6 === 0 ? "男主行为与共犯判断矛盾。" : "新证据指向更高层操盘者。",
      cliffhanger: episodeNo % 4 === 0 ? "一个本该敌对的人替她挡下代价。" : "反派拿出能毁掉她最后退路的证据。",
      characterFunction: weak ? "" : episodeNo % 5 === 0 ? "暴露主角恐惧，让她不只是复仇机器。" : "推动主角从被动反击转向主动布局。",
      audienceNeedServed: episodeNo < episodeCount * 0.5 ? "尊严修复" : "公平清算 / 命运反抗",
      themeFunction: weak ? "" : `通过能力代价推进“${lockedTheme}”。`,
      relationshipChange: weak ? "" : episodeNo % 4 === 0 ? "女主与男主的敌对关系出现裂缝。" : "主角与压迫者的权力位置变化。",
      informationGain: `新增关于幕后规则或母亲旧案的线索 ${episodeNo}。`,
      foreshadowingUsed: episodeNo > 4 ? [`回收第${episodeNo - 4}集的证据漏洞`] : [],
      foreshadowingPlanted: [`能力代价伏笔 ${episodeNo}`, `关系误判伏笔 ${episodeNo}`],
      continuityNotes: [`承接第${Math.max(1, episodeNo - 1)}集悬念`, "不得覆盖已锁定主题和结局"],
      risks: weak ? ["该集事件成立，但人物变化不足。"] : ["注意不要让金手指一次性解决冲突。"]
    };
  });
}

export function generateDraft(project, episodeNo) {
  const outline = project.episodeOutline.find((item) => item.episodeNo === episodeNo) || project.episodeOutline[0];
  if (!outline) return null;
  return {
    episodeNo: outline.episodeNo,
    title: outline.title,
    sceneList: [
      {
        sceneNo: 1,
        location: "宴会厅 / 发布会现场",
        time: "夜",
        characters: ["林照", "林晚", "沈砚", "宾客"],
        actionDescription: `承接细纲：${outline.openingHook} 镜头从围观者手机屏幕切入，舆论压力先到。`,
        dialogue: [
          { character: "林晚", line: "姐姐，只要你道歉，今天的事我可以当没发生。", tone: "委屈", subtext: "逼她承认伪证" },
          { character: "林照", line: "你怕的不是我道歉，是我把完整证据放出来。", tone: "平静", subtext: "掌握信息差" },
          { character: "沈砚", line: "别再用那个能力。", tone: "压低", subtext: "他知道代价" }
        ],
        visualNotes: "手机弹幕、宴会大屏、欲望词条短暂闪现。",
        emotionalBeat: outline.emotionalBeat,
        transition: "切到大屏即将播放的证据文件。"
      },
      {
        sceneNo: 2,
        location: "宴会厅侧廊",
        time: "连续",
        characters: ["林照", "沈砚"],
        actionDescription: "林照追问沈砚为何阻止她，沈砚回避前世真相。",
        dialogue: [
          { character: "林照", line: "前世你也是这样，站在他们那边。", tone: "冷", subtext: "误判和伤口" },
          { character: "沈砚", line: "如果我真站在他们那边，你活不到现在。", tone: "克制", subtext: "反差伏笔" }
        ],
        visualNotes: "左手伤痕特写，作为后续能力反噬伏笔。",
        emotionalBeat: "敌对关系出现裂缝。",
        transition: outline.cliffhanger
      }
    ],
    dialogueStyleNotes: "短句、强信息、每句台词都承担压迫、反击或伏笔。",
    pacingNotes: "开场 10 秒给冲突，结尾保留下一集证据反转。",
    continuityNotes: outline.continuityNotes,
    draftAudit: null
  };
}

export function generateSkillSuggestion(skill, cases = []) {
  return {
    id: uid("skill-suggestion"),
    targetSkillId: skill.id,
    updateReason: "审计发现弱集常见问题：事件成立但人物变化不足。",
    basedOnCases: cases.slice(0, 3).map((item) => item.id),
    proposedRules: [
      "分集生成时若人物功能为空，必须自动补一条欲望、误判、恐惧或关系变化。",
      "连续两集爽点释放时，第二集必须附带信息增量或关系转折。",
      "修复建议必须说明是否影响已锁定主题、大反差和结局。"
    ],
    expectedImprovement: "减少流水账分集，提高人物承载能力。",
    possibleSideEffects: ["生成会更偏结构化，部分台词灵动性下降。"],
    recommendation: "建议创建 1.1.0 测试版本，并用高质量案例集回归。"
  };
}
