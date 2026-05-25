export function auditOutline(project) {
  const episodes = project.episodeOutline || [];
  const issues = [];
  const missingForeshadowing = [];
  const contradictionRisks = [];

  for (const episode of episodes) {
    const episodeIssues = [];
    if (!episode.characterFunction || episode.characterFunction.trim().length < 8) {
      episodeIssues.push({
        episodeNo: episode.episodeNo,
        severity: "high",
        issueType: "人物不足",
        description: "该集事件成立，但人物变化不足。",
        suggestion: "加入主角欲望、误判、恐惧、伤口或关系选择的变化。",
        repairAction: "修复人物功能不足"
      });
    }
    if (!episode.themeFunction || episode.themeFunction.trim().length < 8) {
      episodeIssues.push({
        episodeNo: episode.episodeNo,
        severity: "medium",
        issueType: "主题不足",
        description: "该集没有明确服务已锁定主题。",
        suggestion: "让事件连接自由选择、尊严修复或控制代价。",
        repairAction: "补充主题功能"
      });
    }
    if (!episode.relationshipChange || episode.relationshipChange.trim().length < 6) {
      episodeIssues.push({
        episodeNo: episode.episodeNo,
        severity: "medium",
        issueType: "关系无变化",
        description: "关系状态没有推进，容易变成事件堆砌。",
        suggestion: "让主角与反派、盟友或家族的权力位置发生变化。",
        repairAction: "强化人物关系变化"
      });
    }
    if (!episode.cliffhanger || episode.cliffhanger.trim().length < 6) {
      episodeIssues.push({
        episodeNo: episode.episodeNo,
        severity: "medium",
        issueType: "悬念不足",
        description: "结尾缺少下一集观看理由。",
        suggestion: "补充危机、误会、反转、选择或证据缺口。",
        repairAction: "强化结尾悬念"
      });
    }
    if (episode.goldfingerUse?.includes("一次性解决")) {
      episodeIssues.push({
        episodeNo: episode.episodeNo,
        severity: "high",
        issueType: "金手指滥用",
        description: "金手指解决问题过于直接，会抹平冲突。",
        suggestion: "增加代价、误读或新的阻碍。",
        repairAction: "降低金手指失控"
      });
    }
    issues.push(...episodeIssues);
  }

  if (episodes.length && episodes.filter((item) => item.foreshadowingPlanted?.length).length < Math.ceil(episodes.length * 0.6)) {
    missingForeshadowing.push("主线大反差伏笔密度不足。");
  }

  if (project.lockedMainlineReversal && !String(project.macroOutline?.mainlineReversal || "").includes(project.lockedMainlineReversal.title)) {
    contradictionRisks.push("宏观结构中的大反差没有明确引用已锁定方案。");
  }

  const weakEpisodeNos = [...new Set(issues.map((item) => item.episodeNo))].sort((a, b) => a - b);
  const penalty = Math.min(38, issues.length * 4);
  const score = Math.max(52, 92 - penalty);

  return {
    id: `audit-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    overallScore: score,
    summary:
      issues.length === 0
        ? "细纲结构完整，主题、人物、情绪和悬念均有承载。"
        : `发现 ${issues.length} 个结构问题，优先修复第 ${weakEpisodeNos.slice(0, 6).join("、")} 集。`,
    themeAudit: {
      score: Math.max(55, score - issues.filter((item) => item.issueType === "主题不足").length * 4),
      issues: issues.filter((item) => item.issueType === "主题不足"),
      suggestions: ["每个阶段至少有一次主题选择，不只停留在口号。"]
    },
    characterAudit: {
      score: Math.max(50, score - issues.filter((item) => item.issueType === "人物不足").length * 6),
      weakEpisodes: weakEpisodeNos,
      issues: issues.filter((item) => item.issueType === "人物不足" || item.issueType === "关系无变化"),
      suggestions: ["弱集默认加入人物误判被打破、欲望被暴露或关系权力变化。"]
    },
    reversalAudit: {
      score: missingForeshadowing.length ? score - 8 : score,
      missingForeshadowing,
      contradictionRisks,
      issues: contradictionRisks.map((description, index) => ({
        episodeNo: index + 1,
        severity: "medium",
        issueType: "大反差偏离",
        description,
        suggestion: "在阶段大纲和分集细纲中显式引用锁定大反差。",
        repairAction: "让反转更合理"
      })),
      suggestions: ["早期给异常，中段给裂缝，终局前给完整真相。"]
    },
    emotionalPayoffAudit: {
      score: Math.max(60, score - episodes.filter((item) => !item.coolMoment).length * 3),
      issues: issues.filter((item) => item.issueType === "爽点不足"),
      suggestions: ["爽点要改变信息权、关系权或资源权，不能只有众人震惊。"]
    },
    episodeAudit: {
      score,
      episodeIssues: issues
    },
    suggestions: [
      "先修复高严重度弱集，再统一检查伏笔链。",
      "任何修复都必须保留已锁定主题、大反差、结局和大节点。",
      "修复后重新运行审计，确认人物功能和关系变化不为空。"
    ]
  };
}

export function auditDraft(draft) {
  if (!draft) return null;
  const issues = [];
  for (const scene of draft.sceneList || []) {
    if (!scene.emotionalBeat) {
      issues.push({
        sceneNo: scene.sceneNo,
        severity: "medium",
        issueType: "情绪节拍不足",
        description: "该场戏缺少明确情绪功能。",
        suggestion: "补充压迫、反击、误判或痛感。"
      });
    }
    if (!scene.dialogue?.length) {
      issues.push({
        sceneNo: scene.sceneNo,
        severity: "high",
        issueType: "台词缺失",
        description: "场景没有台词承载冲突。",
        suggestion: "至少加入一组压迫与反击台词。"
      });
    }
  }
  return {
    score: Math.max(62, 90 - issues.length * 8),
    issues,
    suggestions: ["台词必须服务人物，不要只喊口号。", "每场戏都要有冲突、信息或情绪功能。"]
  };
}
