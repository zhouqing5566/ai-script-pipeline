import { audienceNeedTypes, hookTypes } from "./schemas.js";
import { uid } from "./seed-data.js";
import { detectScriptCoverage } from "./script-coverage.js";
import { applyEvidenceValidationToAnalysis } from "./evidence-validator.js";

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
  const coverage = detectScriptCoverage(text, input.episodeCount, { userConfirmedFullScript: input.userConfirmedFullScript });
  const plannedEpisodeCount = Number(input.episodeCount) || coverage.detectedEpisodeCount || detectEpisodeCount(text, input.episodeCount);
  const analysisEpisodeCount = coverage.canAnalyzeFullMainline ? plannedEpisodeCount : Math.max(coverage.detectedEpisodeCount || (text ? 1 : 0), 1);
  const genres = inferGenre(`${input.genre || ""} ${text}`);
  const needs = inferNeeds(text);
  const hook = /退婚|背叛|订婚/.test(text)
    ? "退婚/背叛开局"
    : /重生|死亡/.test(text)
      ? "死亡/重生开局"
      : hookTypes.find((item) => text.includes(item.replace("开局", ""))) || "危机开局";
  const title = input.title || "未命名剧本";
  const baseScore = scoreFromText(text);
  const episodeChunks = splitScriptIntoEpisodeChunks(text);
  const episodeBeatLedger = buildEpisodeBeatLedger({ text, episodeChunks, maxEpisodes: coverage.canAnalyzeFullMainline ? 60 : analysisEpisodeCount });
  const evidenceLedger = buildEvidenceLedger({ coverage, episodeBeatLedger });
  const hookBeatIds = evidenceLedger.hookEvidence.flatMap((item) => item.relatedBeatIds || []);
  const hookEvidenceIds = evidenceLedger.hookEvidence.map((item) => item.id);
  const conflictBeatIds = evidenceLedger.conflictBeats.map((item) => item.beatId).filter(Boolean);
  const goldfingerBeatIds = evidenceLedger.goldfingerEvidence.flatMap((item) => item.relatedBeatIds || []);
  const goldfingerEvidenceIds = evidenceLedger.goldfingerEvidence.map((item) => item.id);
  const suspenseEvidenceIds = evidenceLedger.suspenseEvidence.map((item) => item.id);
  const allEvidenceIds = collectEvidenceIds(evidenceLedger);
  const explicitMeta = analysisMeta({
    evidenceIds: hookEvidenceIds,
    beatIds: hookBeatIds,
    inferenceLevel: "原文明确",
    confidence: 0.86,
    riskNotes: ["开头承诺强，后续必须持续还情绪债。"]
  });
  const insufficientMeta = analysisMeta({
    evidenceIds: evidenceLedger.endingEvidence.map((item) => item.id),
    beatIds: evidenceLedger.endingEvidence.flatMap((item) => item.relatedBeatIds || []),
    inferenceLevel: coverage.canAnalyzeEnding ? "合理推断" : "不足以判断",
    confidence: coverage.canAnalyzeEnding ? 0.7 : 0.28,
    riskNotes: coverage.canAnalyzeEnding ? ["结局必须回收开局承诺。"] : ["当前输入没有足够结局原文证据，不能判断终局兑现。"]
  });
  const characterNames = inferCharacterNames(text);
  const protagonistName = characterNames[0] || "主角";

  const stageStructure = Array.from({ length: 5 }, (_, index) => {
    const stageNo = index + 1;
    const names = ["开局钩子验证", "借势破局升级", "大反差显影", "目标重构", "终局情绪兑现"];
    return {
      stageNo,
      title: names[index],
      episodeRange: coverage.canAnalyzeFullMainline ? rangeForStage(stageNo, 5, plannedEpisodeCount) : "输入不足，仅作创作建议",
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

  const episodes = Array.from({ length: Math.max(analysisEpisodeCount, 1) }, (_, index) => {
    const episodeNo = index + 1;
    const episodeEvidence = evidenceLedger.episodeEvidence.find((item) => item.episodeNo === episodeNo);
    const episodeBeat = episodeBeatLedger.find((item) => item.episodeNo === episodeNo) || episodeBeatLedger[index] || null;
    return {
      episodeNo,
      title: episodeEvidence?.detectedTitle || `第${episodeNo}集：${episodeTitle(episodeNo)}`,
      summary: episodeBeat?.beatSummary || `围绕${needs[0]}推进一次冲突，主角用信息差换取主动权。`,
      openingHook: episodeEvidence?.openingHookBeatIds?.length ? "本集开头由原文危机/疑问 beat 支撑" : episodeNo === 1 ? "公开危机中出现反击机会" : `上一集悬念升级为第${episodeNo}集开场压力`,
      episodeGoal: coverage.canAnalyzeFullMainline
        ? episodeNo < plannedEpisodeCount * 0.4
          ? "夺回叙事权"
          : episodeNo < plannedEpisodeCount * 0.75
            ? "追查深层真相"
            : "完成终局清算"
        : "仅分析输入文本内的本集功能，不推断全剧目标。",
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
      weaknessNotes: coverage.canAnalyzeFullMainline && episodeNo % 9 === 0 ? ["该集事件成立，但人物变化不足。"] : [],
      score: coverage.canAnalyzeFullMainline && episodeNo % 9 === 0 ? 68 : 78 + (episodeNo % 7),
      ...analysisMeta({
        evidenceIds: episodeEvidence ? uniqueList([...(episodeEvidence.openingHookBeatIds || []), ...(episodeEvidence.cliffhangerBeatIds || [])]) : [],
        beatIds: episodeEvidence?.beatIds || (episodeBeat ? [episodeBeat.beatId] : []),
        inferenceLevel: episodeBeat ? "原文明确" : "合理推断",
        confidence: episodeBeat ? 0.82 : 0.48,
        riskNotes: episodeBeat ? [] : ["缺少该集原文 beat，需复核。"]
      })
    };
  });

  const analysisRecord = {
    id: uid("analysis"),
    title,
    coverage,
    caseScope: coverage.allowedCaseScope,
    evidenceLedger,
    episodeBeatLedger,
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
      episodeCount: plannedEpisodeCount,
      estimatedLength: `${plannedEpisodeCount} 集，单集 1-3 分钟`,
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
      riskNotes: ["开头承诺强，后续必须持续还情绪债。"],
      ...explicitMeta
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
      riskNotes: ["爽点需要服务尊严修复，不宜只做围观震惊。"],
      ...analysisMeta({
        evidenceIds: uniqueList([...hookEvidenceIds, ...suspenseEvidenceIds]),
        beatIds: uniqueList([...hookBeatIds, ...conflictBeatIds]),
        inferenceLevel: hookBeatIds.length ? "合理推断" : "不足以判断",
        confidence: hookBeatIds.length ? 0.74 : 0.35,
        riskNotes: hookBeatIds.length ? ["爽点需要服务尊严修复，不宜只做围观震惊。"] : ["爽点需要服务尊严修复，不宜只做围观震惊。", "缺少情绪需求原文证据。"]
      })
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
      riskNotes: ["如果人物没有最终选择，主题会变成口号。"],
      ...analysisMeta({
        evidenceIds: allEvidenceIds.slice(0, 5),
        beatIds: episodeBeatLedger.slice(0, 5).map((beat) => beat.beatId),
        inferenceLevel: coverage.canAnalyzeFullMainline ? "合理推断" : "创作建议",
        confidence: coverage.canAnalyzeFullMainline ? 0.66 : 0.42,
        riskNotes: coverage.canAnalyzeFullMainline ? ["如果人物没有最终选择，主题会变成口号。"] : ["如果人物没有最终选择，主题会变成口号。", "输入不完整，主题只能从当前片段情绪和人物行为推断。"]
      })
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
      riskNotes: coverage.canAnalyzeFullMainline ? ["必须提前埋下幕后规则线索。"] : ["输入不足，不能把该主线当作原文事实。"],
      ...analysisMeta({
        evidenceIds: allEvidenceIds.slice(0, 6),
        beatIds: episodeBeatLedger.slice(0, 6).map((beat) => beat.beatId),
        inferenceLevel: coverage.canAnalyzeFullMainline ? "合理推断" : "创作建议",
        confidence: coverage.canAnalyzeFullMainline ? 0.7 : 0.34,
        riskNotes: coverage.canAnalyzeFullMainline ? ["必须提前埋下幕后规则线索。"] : ["输入不足，不能把该主线当作原文事实。", "完整主线缺少原文覆盖，需在 UI 中按推断展示。"]
      })
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
      riskNotes: coverage.canAnalyzeFullMainline ? ["洗白要有边界，不能抵消前期情绪债。"] : ["当前文本不足以确认主线级大反差，只能作为创作建议。"],
      ...analysisMeta({
        evidenceIds: suspenseEvidenceIds,
        beatIds: uniqueList([...hookBeatIds, ...goldfingerBeatIds]),
        inferenceLevel: coverage.canAnalyzeFullMainline ? "合理推断" : "创作建议",
        confidence: coverage.canAnalyzeFullMainline ? 0.68 : 0.3,
        riskNotes: coverage.canAnalyzeFullMainline ? ["洗白要有边界，不能抵消前期情绪债。"] : ["当前文本不足以确认主线级大反差，只能作为创作建议。", "缺少中后段原文证据，不能标记为原文明确。"]
      })
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
      riskNotes: coverage.canAnalyzeEnding ? ["结局必须回收开局承诺。"] : ["输入不足，无法判断结局是否兑现开头承诺。"],
      ...insufficientMeta
    },
    characterAnalysis: {
      protagonist: makeCharacter(protagonistName, "主角", "从被低估者到能主动选择的人"),
      mainCharacters: characterNames
        .filter((name) => name !== protagonistName)
        .slice(0, 4)
        .map((name, index) => makeCharacter(name, index === 0 ? "关系推动者" : "冲突参与者", "通过与主角的冲突暴露世界规则和情绪债")),
      relationshipEdges: [
        {
          from: protagonistName,
          to: characterNames.find((name) => name !== protagonistName) || "关系对象缺失，需复核",
          initialRelation: "原文片段中存在冲突或试探",
          hiddenRelation: coverage.canAnalyzeFullMainline ? "可能存在未揭示立场" : "输入不足，暂不能判断隐藏关系",
          desireTowardOther: "确认对方真实立场",
          conflict: "一个要追查，一个要阻止能力失控",
          emotionalDebt: "前世死亡现场的误解",
          relationshipShift: coverage.canAnalyzeFullMainline ? "敌对试探 -> 被迫合作 -> 共同选择" : "当前片段只能观察到关系张力",
          finalState: coverage.canAnalyzeFullMainline ? "不靠控制维持信任" : "不足以判断",
          themeFunction: "承载人物选择与误判"
        }
      ],
      characterSystemSummary: "人物系统围绕叙事权、亲密误判和选择代价展开。",
      characterStrengthScore: baseScore - 5,
      riskNotes: ["反派需要有自保逻辑，不能只负责被打脸。"],
      ...analysisMeta({
        evidenceIds: evidenceLedger.characterMentions.map((item) => item.id),
        beatIds: evidenceLedger.characterMentions.map((item) => item.beatId).filter(Boolean),
        inferenceLevel: evidenceLedger.characterMentions.length ? "原文明确" : "不足以判断",
        confidence: evidenceLedger.characterMentions.length ? 0.82 : 0.3,
        riskNotes: evidenceLedger.characterMentions.length ? ["反派需要有自保逻辑，不能只负责被打脸。"] : ["反派需要有自保逻辑，不能只负责被打脸。", "缺少人物出场证据。"]
      })
    },
    goldfingerAnalysis: {
      hasGoldfinger: /系统|面板|能力|看见|透视|银针|蛊|金蚕|巫医|重生/.test(text),
      name: /蛊|金蚕|巫医/.test(text) ? "巫医蛊术与透视诊断" : "隐藏欲望视窗",
      type: /蛊|金蚕|巫医/.test(text) ? "医术 / 蛊术 / 透视能力" : "好感度面板 / 欲望识别",
      visibleFunction: /蛊|金蚕|巫医/.test(text) ? "识别常人看不见的病因或蛊毒，并用特殊手段当众破局。" : "看见他人最强欲望和恐惧，用于取证和反制。",
      hiddenNature: "金手指既提供爽感，也会引出更高层阻碍和人物选择代价。",
      rules: ["能力只能解决具体危机，不能自动解决关系与长期真相", "使用后会引来更强对手或更高层解释"],
      limits: ["不能替代人物选择", "无法一次性解释全剧真相"],
      costs: ["暴露身份", "引来敌对势力注意", "让主角被误判为异类"],
      upgradePath: ["首次破局", "规则暴露", "遭遇反制", "主动选择如何使用"],
      coolUses: ["当众救人/破局", "识破常规权威误判", "反制反派设局", "打开新悬念"],
      misuseRisks: ["主角用能力替代沟通，人物弧光停滞"],
      relationshipToTheme: "金手指把控制感和自由选择的矛盾具象化。",
      relationshipToCharacterArc: "主角越依赖能力，越需要面对自己真正害怕的东西。",
      goldfingerStrengthScore: baseScore - 7,
      riskNotes: ["必须保留限制和代价，否则冲突会被能力抹平。"],
      ...analysisMeta({
        evidenceIds: goldfingerEvidenceIds,
        beatIds: goldfingerBeatIds,
        inferenceLevel: goldfingerBeatIds.length ? "原文明确" : "不足以判断",
        confidence: goldfingerBeatIds.length ? 0.84 : 0.28,
        riskNotes: goldfingerBeatIds.length ? ["必须保留限制和代价，否则冲突会被能力抹平。"] : ["必须保留限制和代价，否则冲突会被能力抹平。", "未在输入文本中找到明确金手指证据。"]
      })
    },
    obstacleAnalysis: {
      obstacleTypes: ["舆论定罪", "家族资源压制", "伪证链", "能力代价", "亲密关系误判"],
      obstacleEscalation: "从个人污名升级为家族旧案和命运规则。",
      antagonistSystem: "表层反派制造污名，幕后者维护规则，旁观者提供舆论压力。",
      whyCannotBeSolvedAtOnce: "证据链被分散，金手指只能看到欲望，不能直接还原事实。",
      pressureMechanism: "每次反击都会暴露一个秘密或引出更高层敌人。",
      obstacleStrengthScore: baseScore - 4,
      riskNotes: ["如果证据太容易获得，长线动力会不足。"],
      ...analysisMeta({
        evidenceIds: uniqueList([...hookEvidenceIds, ...suspenseEvidenceIds]),
        beatIds: conflictBeatIds,
        inferenceLevel: conflictBeatIds.length ? "原文明确" : "合理推断",
        confidence: conflictBeatIds.length ? 0.78 : 0.42,
        riskNotes: conflictBeatIds.length ? ["如果证据太容易获得，长线动力会不足。"] : ["如果证据太容易获得，长线动力会不足。", "阻碍系统缺少足够冲突 beat。"]
      })
    },
    episodeFunctionAnalysis: episodes,
    reusablePatterns: makeReusablePatterns({ title, needs, genres, evidenceLedger, episodeBeatLedger, coverage }),
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
    analystNotes: coverage.inputType === "full_script" ? "分析基于完整度较高的输入生成，仍建议主编复核证据链。" : "当前输入不是完整剧本，完整主线、结局和全剧分集功能均按推断/建议处理。",
    confidence: coverage.inputType === "full_script" ? 0.78 : 0.58,
    needsReview: coverage.inputType !== "full_script",
    usableForLearning: true,
    usableForProduction: coverage.inputType === "full_script",
    sourceMeta: {
      blockedSave: false,
      needsReview: coverage.inputType !== "full_script",
      usableForLearning: true,
      usableForProduction: coverage.inputType === "full_script",
      usableForSkillLearning: coverage.inputType === "full_script",
      usableForFullScriptCase: coverage.inputType === "full_script",
      allowedCaseScope: coverage.allowedCaseScope,
      modelCompletenessScore: 100,
      localFallbackSections: [],
      missingCoreSections: [],
      warnings: coverage.warnings
    }
  };
  applyEvidenceValidationToAnalysis(analysisRecord, text);
  applyLearningFlags(analysisRecord);
  return analysisRecord;
}

function splitScriptIntoEpisodeChunks(text = "") {
  const source = String(text || "").trim();
  if (!source) return [];
  const markerRegex = /(?:^|\n)\s*(第\s*([0-9０-９零〇一二两三四五六七八九十百千]+)\s*[集话回章][^\n]*)/g;
  const matches = [...source.matchAll(markerRegex)];
  if (!matches.length) {
    return [{ episodeNo: null, title: "未分集片段", text: source }];
  }
  return matches.map((match, index) => {
    const start = match.index + (match[0].startsWith("\n") ? 1 : 0);
    const end = matches[index + 1]?.index ?? source.length;
    return {
      episodeNo: parseEpisodeNo(match[2]) || index + 1,
      title: match[1].trim(),
      text: source.slice(start, end).trim()
    };
  });
}

function buildEpisodeBeatLedger({ text, episodeChunks, maxEpisodes }) {
  const chunks = episodeChunks.length ? episodeChunks.slice(0, maxEpisodes || episodeChunks.length) : [{ episodeNo: null, title: "片段", text }];
  const beats = [];
  chunks.forEach((chunk) => {
    const sourceLines = chunk.text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const groups = groupLinesIntoBeats(sourceLines).slice(0, 8);
    groups.forEach((lines, index) => {
      const sourceText = lines.join("\n").trim();
      if (!sourceText) return;
      const beatId = `B${String(beats.length + 1).padStart(3, "0")}`;
      const characters = extractCharacters(sourceText);
      beats.push({
        beatId,
        episodeNo: chunk.episodeNo,
        sceneNo: index + 1,
        sourceText,
        beatSummary: summarizeText(sourceText, 90),
        characters,
        location: inferLocation(sourceText),
        conflict: inferBeatConflict(sourceText),
        audienceEmotion: inferBeatEmotions(sourceText),
        suspenseQuestion: inferSuspenseQuestion(sourceText),
        coolPoint: inferCoolPoint(sourceText),
        characterFunction: characters.length ? `暴露 ${characters.slice(0, 3).join("、")} 的态度、能力或欲望。` : "暴露当前场景中的行动压力。",
        relationshipChange: /质问|跪|救|阻止|威胁|合作|拜|谢/.test(sourceText) ? "关系权力位置发生变化。" : "关系变化不明显。",
        informationGain: inferInformationGain(sourceText),
        structureFunction: inferStructureFunction(sourceText, beats.length),
        reusableValue: inferReusableValue(sourceText),
        relatedModules: inferRelatedModules(sourceText, beats.length),
        confidence: 0.86
      });
    });
  });
  return beats;
}

function groupLinesIntoBeats(lines = []) {
  const groups = [];
  let current = [];
  const flush = () => {
    if (current.length) groups.push(current);
    current = [];
  };
  lines.forEach((line) => {
    const startsScene = /^[△▲◇◆]/.test(line);
    if (startsScene && current.length >= 2) flush();
    current.push(line);
    if (current.length >= 3 || /[？！!?]$/.test(line) || /悬念|转身离开|死定|完了|怎么处理/.test(line)) flush();
  });
  flush();
  return groups.length ? groups : [lines.slice(0, 3)];
}

function buildEvidenceLedger({ coverage, episodeBeatLedger }) {
  let evidenceNo = 0;
  const createEvidence = (beat, evidenceType, summary) => ({
    id: `E${String(++evidenceNo).padStart(3, "0")}`,
    episodeNo: beat.episodeNo,
    sceneNo: beat.sceneNo,
    sourceText: beat.sourceText,
    summary,
    evidenceType,
    relatedCharacters: beat.characters || [],
    relatedBeatIds: [beat.beatId],
    confidence: beat.confidence
  });
  const hookBeats = episodeBeatLedger.slice(0, 2);
  const conflictBeats = episodeBeatLedger
    .filter((beat, index) => index < 8 || /冲突|质问|威胁|阻止|杀|死|毒|救|背叛/.test(beat.sourceText))
    .slice(0, 12)
    .map((beat) => ({ ...createEvidence(beat, "conflict", beat.conflict), beatId: beat.beatId }));
  const hookEvidence = hookBeats.map((beat) => createEvidence(beat, "hook", "开场直接提供危机、疑问或人物反差。"));
  const goldfingerEvidence = episodeBeatLedger
    .filter((beat) => /系统|面板|能力|看见|透视|银针|蛊|金蚕|巫医|重生|特效/.test(beat.sourceText))
    .slice(0, 8)
    .map((beat) => createEvidence(beat, "goldfinger", "原文出现特殊能力、金手指或非常规破局手段。"));
  const suspenseEvidence = episodeBeatLedger
    .filter((beat) => /什么|为什么|怎么|难道|真相|来头|身份|？|\?/.test(beat.sourceText))
    .slice(0, 8)
    .map((beat) => createEvidence(beat, "suspense", "该 beat 提供观众追问或身份悬念。"));
  const endingEvidence = coverage.canAnalyzeEnding ? episodeBeatLedger.slice(-2).map((beat) => createEvidence(beat, "ending", "结尾或终局相关证据。")) : [];
  const characterMentions = collectCharacterMentions(episodeBeatLedger);
  const scenes = episodeBeatLedger.map((beat) => ({
    sceneId: `S${String(beat.sceneNo || 1).padStart(3, "0")}-${beat.beatId}`,
    episodeNo: beat.episodeNo,
    sceneNo: beat.sceneNo,
    location: beat.location,
    characters: beat.characters,
    sceneSummary: beat.beatSummary,
    sourceTextPreview: summarizeText(beat.sourceText, 110),
    beatIds: [beat.beatId]
  }));
  const episodeEvidence = Object.values(
    episodeBeatLedger.reduce((acc, beat) => {
      const no = beat.episodeNo || 1;
      acc[no] ||= {
        episodeNo: no,
        detectedTitle: `第${no}集`,
        beatIds: [],
        openingHookBeatIds: [],
        cliffhangerBeatIds: [],
        evidenceCompleteness: 0
      };
      acc[no].beatIds.push(beat.beatId);
      if (beat.structureFunction.includes("开头") || acc[no].openingHookBeatIds.length < 1) acc[no].openingHookBeatIds.push(beat.beatId);
      return acc;
    }, {})
  ).map((item) => ({
    ...item,
    cliffhangerBeatIds: item.beatIds.slice(-1),
    evidenceCompleteness: Math.min(1, Math.round((item.beatIds.length / 5) * 100) / 100)
  }));

  return {
    coverage,
    scenes,
    characterMentions,
    conflictBeats,
    hookEvidence,
    goldfingerEvidence,
    suspenseEvidence,
    endingEvidence,
    episodeEvidence
  };
}

function collectCharacterMentions(beats = []) {
  const seen = new Map();
  beats.forEach((beat) => {
    (beat.characters || []).forEach((character) => {
      const key = `${character}-${beat.beatId}`;
      if (seen.has(key)) return;
      seen.set(key, {
        id: `M${String(seen.size + 1).padStart(3, "0")}`,
        character,
        episodeNo: beat.episodeNo,
        sceneNo: beat.sceneNo,
        beatId: beat.beatId,
        sourceText: beat.sourceText,
        summary: `${character} 在该 beat 中被提及或发言。`,
        confidence: 0.8
      });
    });
  });
  return [...seen.values()].slice(0, 40);
}

function analysisMeta({ evidenceIds = [], beatIds = [], inferenceLevel = "合理推断", confidence = 0.6, riskNotes = [] } = {}) {
  const uniqueEvidenceIds = uniqueList(evidenceIds);
  const uniqueBeatIds = uniqueList(beatIds);
  return {
    evidenceIds: uniqueEvidenceIds,
    evidenceBeatIds: uniqueBeatIds,
    inferenceLevel,
    confidence,
    needsReview: uniqueEvidenceIds.length === 0 && uniqueBeatIds.length === 0,
    riskNotes: uniqueList([...(riskNotes || []), ...(uniqueEvidenceIds.length || uniqueBeatIds.length ? [] : ["该模块缺少原文证据。"])])
  };
}

function applyLearningFlags(analysis) {
  const meta = (analysis.sourceMeta ||= {});
  const invalidRatio = meta.evidenceValidation?.invalidEvidenceRatio || 0;
  const localFallbackCount = (meta.localFallbackSections || []).length;
  const isFullScript = analysis.coverage?.inputType === "full_script";
  meta.usableForCaseSave = !meta.blockedSave;
  meta.usableForPatternExtraction = !meta.blockedSave && invalidRatio <= 0.3;
  meta.usableForFullScriptCase = isFullScript && !meta.blockedSave && invalidRatio === 0;
  meta.usableForSkillLearning = isFullScript && !meta.blockedSave && !meta.needsReview && localFallbackCount === 0 && invalidRatio === 0;
  meta.usableForLearning = meta.usableForSkillLearning;
  analysis.usableForLearning = meta.usableForLearning;
  analysis.usableForProduction = isFullScript && !meta.blockedSave;
}

function collectEvidenceIds(evidenceLedger) {
  return uniqueList(
    [
      ...(evidenceLedger.hookEvidence || []),
      ...(evidenceLedger.goldfingerEvidence || []),
      ...(evidenceLedger.suspenseEvidence || []),
      ...(evidenceLedger.endingEvidence || [])
    ].map((item) => item.id)
  );
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

function makeReusablePatterns({ title, needs, genres, evidenceLedger, episodeBeatLedger, coverage }) {
  const hookEvidenceIds = evidenceLedger.hookEvidence.map((item) => item.id);
  const hookBeatIds = evidenceLedger.hookEvidence.flatMap((item) => item.relatedBeatIds || []);
  const goldfingerEvidenceIds = evidenceLedger.goldfingerEvidence.map((item) => item.id);
  const goldfingerBeatIds = evidenceLedger.goldfingerEvidence.flatMap((item) => item.relatedBeatIds || []);
  const hasSourceEvidence = hookEvidenceIds.length || hookBeatIds.length;
  return [
    {
      id: uid("pattern"),
      sourceScriptId: "current-analysis",
      patternType: "hook",
      title: "公共空间突发危机 + 被轻视者破局",
      description: "在公共场景制造紧急危机，让权威误判或失败，再由被低估的主角用特殊能力破局。",
      sourceEvidenceIds: hookEvidenceIds,
      sourceBeatIds: hookBeatIds,
      applicableGenres: genres,
      applicableAudienceNeeds: needs,
      structureSteps: ["公共场景制造紧急危机", "权威角色误判或失败", "主角被质疑或被低估", "主角提出反常判断", "群众/权威阻拦", "主角用金手指破局", "权威震惊", "新悬念打开"],
      variableSlots: {
        scene: ["火车", "医院", "婚宴", "拍卖会"],
        crisis: ["中毒", "怪病", "走火入魔", "命案"],
        authority: ["医生", "长老", "专家", "官员"],
        ability: ["医术", "毒术", "玄术", "系统识别"]
      },
      whyItWorks: "同时满足危机压迫、身份反差、尊严修复和继续追看的身份悬念。",
      emotionalMechanism: "先让观众替主角承受质疑，再通过当众破局释放尊严修复。",
      characterFunction: "快速证明主角不是普通人，同时保留来历和代价疑问。",
      plotFunction: "用一次可视化破局打开金手指、反派势力和下一层悬念。",
      risks: ["如果权威太蠢，会削弱破局含金量。", "如果能力无限制，中后段冲突会被抹平。"],
      antiPatterns: ["只让路人震惊但不引出新阻碍", "只展示能力，不建立人物目标或代价"],
      reusePrompt: "基于该模式，替换 scene/crisis/authority/ability 变量，生成一个适用于新题材的开头破局桥段，并保留新悬念。",
      exampleEpisodes: [1, 2],
      confidence: hasSourceEvidence ? 0.84 : 0.42,
      inferenceLevel: hasSourceEvidence ? "原文明确" : "创作建议"
    },
    {
      id: uid("pattern"),
      sourceScriptId: "current-analysis",
      patternType: "goldfingerUse",
      title: "特殊能力破局后立刻引来更高层对手",
      description: `${title} 可以用关系误判支撑中后段惊奇。`,
      sourceEvidenceIds: goldfingerEvidenceIds,
      sourceBeatIds: goldfingerBeatIds,
      applicableGenres: genres,
      applicableAudienceNeeds: needs,
      structureSteps: ["主角用能力解决眼前危机", "旁观者/权威改变评价", "反派发现能力威胁", "更专业的对手登场", "能力规则或身份来历被追问", "下一集进入能力反制"],
      variableSlots: {
        ability: ["巫医蛊术", "系统识别", "隐藏身份", "重生记忆"],
        observer: ["医生", "老板", "同门", "女主/男主"],
        higherEnemy: ["蛊师", "家族高手", "系统监管者", "幕后策划者"],
        cost: ["身份暴露", "体力反噬", "关键材料缺口", "关系误会"]
      },
      whyItWorks: "爽点之后马上给出更强阻碍，避免能力一次解决所有问题。",
      emotionalMechanism: "先兑现爽感，再把期待转化为对下一层敌人的好奇。",
      characterFunction: "让主角的强大和限制同时成立。",
      plotFunction: "从单场破局推进到长期阻碍系统。",
      risks: ["如果只升级敌人不升级人物选择，会变成重复打怪。"],
      antiPatterns: ["每次只换一个更强反派", "能力没有代价也没有误用风险"],
      reusePrompt: "沿用该模式，写一个主角第一次使用金手指后引来更高层对手的桥段，必须包含能力限制或身份风险。",
      exampleEpisodes: [4, 12, 20],
      confidence: goldfingerBeatIds.length ? 0.78 : 0.38,
      inferenceLevel: goldfingerBeatIds.length ? "合理推断" : "创作建议"
    }
  ];
}

function parseEpisodeNo(value = "") {
  const normalized = String(value).replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 65248));
  if (/^\d+$/.test(normalized)) return Number(normalized);
  const map = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (normalized === "十") return 10;
  if (normalized.includes("十")) {
    const [tens, ones] = normalized.split("十");
    return (tens ? map[tens] || 1 : 1) * 10 + (ones ? map[ones] || 0 : 0);
  }
  return map[normalized] || null;
}

function extractCharacters(text = "") {
  const names = [];
  for (const match of String(text).matchAll(/([\u4e00-\u9fa5A-Za-z0-9]{1,10})(?:（[^）]*）)?[：:]/g)) {
    const name = match[1].trim();
    if (name && !/医生|龙套|旁白|字幕|标注|特效|闪回/.test(name)) names.push(name);
    else if (name) names.push(name);
  }
  return uniqueList(names).slice(0, 5);
}

function inferCharacterNames(text = "") {
  const counts = new Map();
  for (const match of String(text).matchAll(/([\u4e00-\u9fa5A-Za-z0-9]{1,10})(?:（[^）]*）)?[：:]/g)) {
    const name = match[1].trim();
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  }
  for (const match of String(text).matchAll(/【标注：([^，,】]+)/g)) {
    const name = match[1].trim();
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .filter(Boolean)
    .slice(0, 6);
}

function inferLocation(text = "") {
  if (/火车|包厢|车厢/.test(text)) return "火车/包厢";
  if (/医院|病房|医生/.test(text)) return "医疗场景";
  if (/宴|婚|订婚/.test(text)) return "宴会/公开场合";
  if (/山|门派|师父/.test(text)) return "山门/修行场景";
  return "未明确";
}

function inferBeatConflict(text = "") {
  if (/死|救|毒|脑溢血|出血|抽搐/.test(text)) return "生死危机与救治失败压力。";
  if (/质问|阻止|住手|担得起|杀人/.test(text)) return "主角行动被权威或反派阻拦。";
  if (/威胁|后退|跪|责罚/.test(text)) return "强弱位置发生压制或反转。";
  return "当前 beat 的冲突需要结合上下文判断。";
}

function inferBeatEmotions(text = "") {
  const emotions = [];
  if (/死|救|危|毒|抽搐/.test(text)) emotions.push("紧张");
  if (/质问|阻止|羞辱|瞎搞/.test(text)) emotions.push("压迫");
  if (/什么|难道|来头|居然|怎么/.test(text)) emotions.push("好奇");
  if (/救活|醒|谢|震惊|大师死了/.test(text)) emotions.push("爽感释放");
  return emotions.length ? emotions : ["观望"];
}

function inferSuspenseQuestion(text = "") {
  if (/来头|VVVVIP|身份/.test(text)) return "主角到底是什么来历？";
  if (/蛊|虫|金蚕|透视/.test(text)) return "这种非常规能力的规则和代价是什么？";
  if (/为什么|为何/.test(text)) return "背后的动机是什么？";
  return /[？?]/.test(text) ? "观众会追问这个异常现象如何解释。" : "";
}

function inferCoolPoint(text = "") {
  if (/银针|金蚕|透视|巫医|蛊/.test(text)) return "非常规医术/蛊术可视化破局。";
  if (/VVVVIP|大人物|恭敬/.test(text)) return "隐藏身份带来的地位反差。";
  if (/掐断|跪拜|谢胖爷/.test(text)) return "强者身份突然显露。";
  return "";
}

function inferInformationGain(text = "") {
  if (/不是脑溢血|被人害|蛊/.test(text)) return "观众知道危机并非常规疾病，而是人为或超常因素。";
  if (/VVVVIP|大人物/.test(text)) return "观众获得主角身份不普通的线索。";
  if (/一个月|必死|材料/.test(text)) return "观众获得主角生命倒计时和长期目标。";
  return "提供新的行动信息或人物态度。";
}

function inferStructureFunction(text = "", index = 0) {
  if (index === 0) return "开头钩子";
  if (/银针|金蚕|透视|系统|能力|巫医|蛊/.test(text)) return "金手指引出";
  if (/什么|为什么|来头|身份|难道|？|\?/.test(text)) return "悬念制造";
  if (/袁超|反派|杀|坏我好事|死定/.test(text)) return "反派压迫";
  if (/醒|救|震惊|跪|谢/.test(text)) return "爽点释放";
  return "主线推进";
}

function inferReusableValue(text = "") {
  if (/火车|医院|医生|救/.test(text)) return "可复用为公共空间突发危机开头。";
  if (/VVVVIP|隐藏|身份|来头/.test(text)) return "可复用为身份反差钩子。";
  if (/银针|金蚕|蛊|系统|能力/.test(text)) return "可复用为金手指可视化破局桥段。";
  return "可作为人物关系或冲突节奏参考。";
}

function inferRelatedModules(text = "", index = 0) {
  const modules = new Set(["episodeFunctionAnalysis"]);
  if (index < 2) modules.add("hookAnalysis");
  if (/情绪|羞辱|质问|救|死|危|震惊/.test(text)) modules.add("audienceNeedAnalysis");
  if (/银针|金蚕|蛊|系统|能力|透视/.test(text)) modules.add("goldfingerAnalysis");
  if (/主角|师父|老师|老板|医生|袁|孙|苏/.test(text)) modules.add("characterAnalysis");
  if (/真相|来头|身份|为什么|幕后/.test(text)) modules.add("mainlineStructure");
  return [...modules];
}

function uniqueList(items = []) {
  return [...new Set(items.filter(Boolean))];
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
