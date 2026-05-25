export function repairEpisode(project, episodeNo, repairType = "修复人物功能不足") {
  const episode = project.episodeOutline.find((item) => item.episodeNo === episodeNo);
  if (!episode) return { project, repair: null };

  const before = JSON.stringify(episode, null, 2);
  const repaired = {
    ...episode,
    conflict:
      episode.conflict === "反派挑衅，主角反打，众人震惊。"
        ? "反派用伪证逼主角当众道歉，主角必须在立刻反打和保留证据钓出幕后者之间选择。"
        : episode.conflict,
    keyEvent:
      episode.keyEvent === "主角在宴会上反打反派。"
        ? "主角先放出半份证据，让继妹误以为自己还有退路，从而引出幕后联系人。"
        : episode.keyEvent,
    characterFunction:
      episode.characterFunction || "主角暴露“急于掌控一切”的误判，并第一次选择延迟复仇以换取更大真相。",
    themeFunction:
      episode.themeFunction || "通过延迟反击证明自由选择不是立刻控制局面，而是承担更高代价。",
    relationshipChange:
      episode.relationshipChange || "男主发现她没有被仇恨完全吞没，敌对关系出现可合作的裂缝。",
    emotionalBeat:
      episode.emotionalBeat === "爽点释放但人物痛感不足。"
        ? "爽点释放后立刻带出代价，主角短暂动摇但选择继续查真相。"
        : episode.emotionalBeat,
    informationGain:
      episode.informationGain || "新增幕后联系人线索，证明表层反派不是唯一敌人。",
    cliffhanger: episode.cliffhanger || "幕后联系人发来消息：她母亲当年也做过同样选择。",
    risks: ["已修复人物变化不足；需确认不会提前泄露终局真相。"]
  };

  const nextProject = {
    ...project,
    episodeOutline: project.episodeOutline.map((item) => (item.episodeNo === episodeNo ? repaired : item)),
    updatedAt: new Date().toISOString()
  };

  const repair = {
    id: `repair-${Date.now().toString(36)}`,
    targetType: "episode",
    targetId: String(episodeNo),
    repairType,
    before,
    after: JSON.stringify(repaired, null, 2),
    changeSummary: `第 ${episodeNo} 集补充人物误判、主题选择和关系变化，避免只剩事件反打。`,
    impactScope: ["分集细纲", "人物弧光", "主线大反差伏笔"],
    risks: ["如果这集承担太多信息，节奏可能变重。"],
    createdAt: new Date().toISOString()
  };

  return { project: nextProject, repair };
}
