import { summarizeSkillForPrompt } from "./skill-manager.js";

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
  "不要擅自修改已锁定主题、主线大反差、结局和大节点。"
];

export function buildPrompt({ taskType, project, input, matchedSkills = [], outputSchema }) {
  const lockedAnchors = describeLockedAnchors(project);
  const skillBlock = matchedSkills.length
    ? matchedSkills.map(summarizeSkillForPrompt).join("\n\n")
    : "未匹配到专用 Skill，仅使用通用系统原则。";
  const schemaBlock = outputSchema ? JSON.stringify(outputSchema, null, 2) : "请返回符合任务要求的 JSON 对象。";
  const user = [
    `当前任务：${taskType}`,
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
  return {
    system: systemPrinciples.join("\n"),
    user,
    messages: [
      { role: "system", content: systemPrinciples.join("\n") },
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
