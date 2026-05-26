import { summarizeSkillForPrompt } from "./skill-manager.js";
import { getTaskOutputContract } from "./task-output-contracts.js";

const systemPrinciples = [
  "你是一个专业短剧、漫剧、爽剧、网文改编方向的剧本结构顾问。",
  "你的任务不是直接随意写完整剧本，而是帮助创作者完成结构化分析、模式提取、创作决策、细纲生产和审计修复。",
  "先判断观众情绪需求，再设计主题。",
  "主题不是口号，而是观众情绪需求的高级表达。",
  "情节最终是为人物服务的。",
  "开头必须有强钩子、强反差、强冲突或强悬念。",
  "整体主线最好有中后段可揭示的大反差或反套路。",
  "金手指既要提供爽感，也要有规则、限制、代价和升级。",
  "每集细纲必须包含人物功能、情绪功能、主题功能和关系变化。",
  "审计必须独立于生成，不能生成完自己无脑夸自己。"
];

const prohibitions = [
  "不要忽略锁定内容。",
  "不要只写剧情摘要。",
  "不要机械打脸。",
  "不要为了反转而反转。",
  "不要输出无法解析的 JSON。",
  "不要用 Demo 数据冒充真实生成。",
  "不要擅自修改已锁定主题、主线大反差、结局和大节点。",
  "不要把没有原文证据的推断写成事实。",
  "不要在输入不完整时生成确定性的完整主线、结局或全剧分集功能。",
  "不要编造 sourceText；sourceText 必须能在用户输入中找到。"
];

const strictJsonTaskTypes = new Set([
  "analyzeScript",
  "analyzeEpisodeChunk",
  "analyzeScriptChunk",
  "aggregateScriptAnalysis",
  "mergeEvidenceLedAnalysis",
  "schemaRepairAnalyzeScript",
  "schemaRepairAnalyzeEpisodeChunk",
  "jsonRepair"
]);

const strictJsonOnlyPrompt = [
  "你是严格 JSON 生成器，不是聊天助手。",
  "你只能输出一个 JSON 对象或 JSON 数组。",
  "禁止输出任何解释、前言、总结、道歉。",
  "禁止输出 Markdown。",
  "禁止输出 ```json 代码块。",
  "禁止输出“作为剧本结构顾问”等自然语言开头。",
  "如果任务要求对象，第一个字符必须是 {，最后一个字符必须是 }。",
  "如果任务要求数组，第一个字符必须是 [，最后一个字符必须是 ]。",
  "输出必须能被 JSON.parse 直接解析。"
];

const episodeChunkHardUserBlock = `你正在执行 analyzeEpisodeChunk。
根对象必须直接是 EpisodeChunkAnalysis。
禁止返回 episodeAnalysis。
禁止返回 structuralAnalysis。
禁止返回 result/data/output 包裹。
禁止返回数组。
必须返回以下顶层字段：
- episodeNo
- title
- evidenceLedger
- episodeBeatLedger
- episodeFunctionAnalysis
- reusablePatterns
- openQuestions
- continuityNotes
- confidence
- needsReview

必须严格返回这个最小结构：
{
  "episodeNo": 1,
  "title": "第一集",
  "evidenceLedger": {
    "hookEvidence": [
      {
        "id": "E001",
        "episodeNo": 1,
        "sourceText": "火车上，林清韵忽然吐血。",
        "summary": "火车突发吐血危机，形成开头钩子。",
        "evidenceType": "hook",
        "relatedBeatIds": ["B001"],
        "confidence": 0.8
      }
    ],
    "conflictBeats": [],
    "suspenseEvidence": [],
    "episodeEvidence": [
      {
        "episodeNo": 1,
        "beatIds": ["B001"],
        "openingHookBeatIds": ["B001"],
        "cliffhangerBeatIds": [],
        "evidenceCompleteness": 0.8
      }
    ]
  },
  "episodeBeatLedger": [
    {
      "beatId": "B001",
      "episodeNo": 1,
      "sceneNo": 1,
      "sourceText": "火车上，林清韵忽然吐血。",
      "beatSummary": "林清韵在火车上突然吐血，制造开头危机。",
      "characters": ["林清韵"],
      "audienceEmotion": ["紧张", "好奇"],
      "suspenseQuestion": "她为什么突然吐血？",
      "structureFunction": "开头钩子",
      "confidence": 0.8
    }
  ],
  "episodeFunctionAnalysis": {
    "episodeNo": 1,
    "summary": "本集用火车吐血危机开场，引出主角识别蛊毒的能力。",
    "openingHook": "林清韵在火车上突然吐血。",
    "mainConflict": "突发蛊毒危机与无人能解的困境。",
    "coolMoment": "孙大为看出蛊毒。",
    "informationGain": "观众知道这个世界存在蛊毒与特殊医术。",
    "characterFunction": "引出孙大为的特殊判断能力。",
    "cliffhanger": "蛊毒来源尚未揭开。",
    "evidenceBeatIds": ["B001"],
    "inferenceLevel": "原文明确",
    "confidence": 0.8,
    "riskNotes": []
  },
  "reusablePatterns": [],
  "openQuestions": ["蛊毒来源是谁？"],
  "continuityNotes": [],
  "confidence": 0.8,
  "needsReview": false
}

强调：
sourceText 必须逐字来自 episodeText。
episodeFunctionAnalysis.evidenceBeatIds 必须引用 episodeBeatLedger 中真实存在的 beatId。
不要输出任何其他字段名。`;

export function buildPrompt({ taskType, project, input, matchedSkills = [], outputSchema }) {
  const lockedAnchors = describeLockedAnchors(project);
  const skillBlock = matchedSkills.length
    ? matchedSkills.map(summarizeSkillForPrompt).join("\n\n")
    : "未匹配到专用 Skill，仅使用通用系统原则。";
  const compactContract = taskType === "analyzeEpisodeChunk" || taskType === "analyzeScriptChunk";
  const schemaBlock = outputSchema ? JSON.stringify(outputSchema, null, 2) : getTaskOutputContract(taskType, { compact: compactContract }) || "请返回符合任务要求的 JSON 对象。";
  const jsonOnlyBlock = strictJsonTaskTypes.has(taskType)
    ? [
        "JSON-only 硬约束：",
        ...strictJsonOnlyPrompt.map((item, index) => `${index + 1}. ${item}`),
        taskType === "analyzeEpisodeChunk" || taskType === "schemaRepairAnalyzeEpisodeChunk" ? "10. 只返回 EpisodeChunkAnalysis JSON 对象；不要输出全剧分析；不要输出“下面是分析结果”。" : ""
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const user = [
    taskType === "analyzeEpisodeChunk" ? episodeChunkHardUserBlock : "",
    taskType === "analyzeEpisodeChunk" ? "" : "",
    `当前任务：${taskType}`,
    jsonOnlyBlock ? `\n${jsonOnlyBlock}` : "",
    "",
    "已锁定创作锚点：",
    lockedAnchors,
    "",
    "匹配到的 Skill 规则：",
    skillBlock,
    "",
    "输入材料：",
    JSON.stringify(input || {}, null, 2),
    "",
    "输出 JSON schema / 结构要求：",
    schemaBlock,
    "",
    "禁止事项：",
    prohibitions.map((item, index) => `${index + 1}. ${item}`).join("\n")
  ].join("\n");
  const system = [
    ...(strictJsonTaskTypes.has(taskType) ? strictJsonOnlyPrompt : []),
    ...(taskType === "analyzeEpisodeChunk" || taskType === "schemaRepairAnalyzeEpisodeChunk" ? ["只返回 EpisodeChunkAnalysis JSON 对象；不要输出全剧分析；不要输出“下面是分析结果”。"] : []),
    ...systemPrinciples
  ].join("\n");
  return {
    system,
    user,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  };
}

function describeLockedAnchors(project = {}) {
  if (!project) return "无项目上下文。";
  const rows = [
    ["创意方向", project.locks?.direction ? project.selectedDirection?.title : "未锁定"],
    ["主题与情绪", project.locks?.theme ? project.lockedTheme?.themeStatement : "未锁定"],
    ["主线大反差", project.locks?.reversal ? project.lockedMainlineReversal?.title : "未锁定"],
    ["结局", project.locks?.ending ? project.lockedEnding?.title : "未锁定"],
    ["大节点", project.locks?.majorNodes ? project.lockedMajorNodes?.title : "未锁定"],
    ["人物核心", project.locks?.characterCore ? "已锁定" : "未锁定"],
    ["金手指", project.locks?.goldfinger ? "已锁定" : "未锁定"],
    ["阶段大纲", project.locks?.stageOutline ? "已锁定" : "未锁定"],
    ["分集细纲", project.locks?.episodeOutline ? "已锁定" : "未锁定"]
  ];
  return rows.map(([label, value]) => `- ${label}：${value || "未填写"}`).join("\n");
}
