const episodeMarkerPattern = /(?:^|\n)\s*(第\s*([0-9０-９零〇一二两三四五六七八九十百千]+)\s*[集话回章][^\n]*)/g;

export function detectScriptCoverage(scriptText = "", userEpisodeCount = null, options = {}) {
  const text = String(scriptText || "").trim();
  const userConfirmedFullScript = Boolean(options.userConfirmedFullScript);
  const userCount = Number(userEpisodeCount) > 0 ? Number(userEpisodeCount) : null;
  const detectedEpisodeMarkers = [...text.matchAll(episodeMarkerPattern)].map((match) => match[1].trim());
  const detectedEpisodeCount = uniqueEpisodeMarkerCount(detectedEpisodeMarkers);
  const hasEpisodeMarkers = detectedEpisodeCount > 0;
  const dialogueLineCount = (text.match(/^[\s\S]{0,12}[：:]/gm) || []).length;
  const sceneMarkerCount = (text.match(/(?:^|\n)\s*[△▲◇◆]/g) || []).length;
  const outlineSignals = /故事大纲|分集大纲|剧情梗概|人物小传|阶段大纲|主线|结局|核心设定|节点/.test(text);
  const looksLikeOutline = outlineSignals && dialogueLineCount < 6 && sceneMarkerCount < 3;
  const looksLikeSynopsis = /梗概|简介|故事概述|一句话/.test(text) && dialogueLineCount < 4;
  const hasEndingSignal = /大结局|终局|最终|结局|尾声|全剧终/.test(text);
  const coverageRatio = estimateCoverageRatio({ text, userCount, detectedEpisodeCount, looksLikeOutline, looksLikeSynopsis, hasEndingSignal, userConfirmedFullScript });
  const fullScriptConfidence = estimateFullScriptConfidence({ userCount, detectedEpisodeCount, coverageRatio, hasEndingSignal, userConfirmedFullScript });
  const fullScriptByUserCount = Boolean(userCount && detectedEpisodeCount && coverageRatio >= 0.78);
  const fullScriptByEnding = Boolean(hasEndingSignal && detectedEpisodeCount >= 3);
  const isConfirmedFullScript = userConfirmedFullScript || fullScriptByUserCount || fullScriptByEnding;
  const requiresManualFullScriptConfirmation = Boolean(!isConfirmedFullScript && !userCount && !hasEndingSignal && detectedEpisodeCount >= 3);

  let inputType = "unknown";
  if (!text) inputType = "unknown";
  else if (isConfirmedFullScript) inputType = "full_script";
  else if (looksLikeSynopsis) inputType = "synopsis";
  else if (looksLikeOutline) inputType = "outline";
  else if (detectedEpisodeCount === 1) inputType = "single_episode";
  else if (detectedEpisodeCount > 1) inputType = "partial_script";
  else if (text.length < 1200 || dialogueLineCount < 4) inputType = "fragment";
  else inputType = "partial_script";

  const canAnalyzeOpening = text.length > 0;
  const canAnalyzeFullMainline = inputType === "full_script" || inputType === "outline" || inputType === "synopsis";
  const canAnalyzeEnding = inputType === "full_script" || (canAnalyzeFullMainline && hasEndingSignal);
  const canAnalyzeEpisodeFunctions = inputType === "full_script" || detectedEpisodeCount > 0;
  const canAnalyzeReusablePatterns = text.length > 80;
  const allowedCaseScope = decideCaseScope({ inputType, detectedEpisodeMarkers });
  const warnings = buildCoverageWarnings({
    inputType,
    userCount,
    detectedEpisodeCount,
    coverageRatio,
    canAnalyzeFullMainline,
    canAnalyzeEnding
  });

  return {
    inputType,
    detectedEpisodeCount,
    userEpisodeCount: userCount,
    hasEpisodeMarkers,
    detectedEpisodeMarkers,
    estimatedCoverageRatio: coverageRatio,
    fullScriptConfidence,
    requiresManualFullScriptConfirmation,
    coverageReason: coverageReason({ inputType, detectedEpisodeCount, userCount, coverageRatio, looksLikeOutline, looksLikeSynopsis }),
    canAnalyzeOpening,
    canAnalyzeFullMainline,
    canAnalyzeEnding,
    canAnalyzeEpisodeFunctions,
    canAnalyzeReusablePatterns,
    allowedCaseScope,
    warnings
  };
}

function uniqueEpisodeMarkerCount(markers = []) {
  const normalized = markers.map((marker) => marker.replace(/\s+/g, ""));
  return new Set(normalized).size;
}

function estimateCoverageRatio({ text, userCount, detectedEpisodeCount, looksLikeOutline, looksLikeSynopsis }) {
  if (!text) return 0;
  if (userCount && detectedEpisodeCount) return roundRatio(Math.min(1, detectedEpisodeCount / userCount));
  if (userCount && !detectedEpisodeCount) return roundRatio(Math.min(0.45, text.length / Math.max(userCount * 900, 1)));
  if (looksLikeOutline || looksLikeSynopsis) return 0.55;
  if (detectedEpisodeCount >= 8) return 0.75;
  if (detectedEpisodeCount > 1) return roundRatio(Math.min(0.75, detectedEpisodeCount / 8));
  if (detectedEpisodeCount === 1) return 0.12;
  return roundRatio(Math.min(0.25, text.length / 5000));
}

function estimateFullScriptConfidence({ userCount, detectedEpisodeCount, coverageRatio, hasEndingSignal, userConfirmedFullScript }) {
  if (userConfirmedFullScript) return 0.95;
  if (userCount && detectedEpisodeCount) return roundRatio(Math.min(0.9, coverageRatio));
  if (hasEndingSignal && detectedEpisodeCount >= 3) return 0.82;
  if (detectedEpisodeCount >= 8) return 0.42;
  return 0.2;
}

function roundRatio(value) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function decideCaseScope({ inputType, detectedEpisodeMarkers }) {
  if (inputType === "full_script") return "full_script";
  if (inputType === "single_episode") {
    return detectedEpisodeMarkers.some((marker) => /第一|第\s*1\s*[集话回章]/.test(marker)) ? "opening_case" : "episode_case";
  }
  if (inputType === "partial_script") return "episode_case";
  return "fragment_case";
}

function buildCoverageWarnings({ inputType, userCount, detectedEpisodeCount, coverageRatio, canAnalyzeFullMainline, canAnalyzeEnding }) {
  const warnings = [];
  if (userCount && detectedEpisodeCount && detectedEpisodeCount < userCount) {
    warnings.push(`用户填写 ${userCount} 集，但文本只检测到 ${detectedEpisodeCount} 集，完整主线/结局/全剧分集功能只能作为推断。`);
  }
  if (userCount && !detectedEpisodeCount && coverageRatio < 0.5) {
    warnings.push(`用户填写 ${userCount} 集，但文本未检测到明确分集标记，需人工确认是否为梗概或片段。`);
  }
  if (!canAnalyzeFullMainline) warnings.push("当前输入不足以确定完整主线，只能输出原文范围内的结构判断和创作推断。");
  if (!canAnalyzeEnding) warnings.push("当前输入不足以判断结局，结局分析必须标记为不足以判断或创作建议。");
  if (inputType !== "full_script") warnings.push("当前输入不是完整剧本，只能作为片段/开头/单集案例保存。");
  if (!userCount && detectedEpisodeCount >= 3 && inputType !== "full_script") {
    warnings.push("检测到多集文本，但未发现总集数或终局信号，暂按部分剧本处理。若这是完整剧本，请手动确认。");
  }
  return warnings;
}

function coverageReason({ inputType, detectedEpisodeCount, userCount, coverageRatio, looksLikeOutline, looksLikeSynopsis }) {
  if (looksLikeSynopsis) return "文本更像剧情梗概，缺少逐场原文证据。";
  if (looksLikeOutline) return "文本包含大纲/节点信号，适合宏观判断，但不适合逐场证据拆解。";
  if (inputType === "single_episode") return "只检测到 1 个分集标记，按单集/开头案例处理。";
  if (inputType === "full_script") return `检测到 ${detectedEpisodeCount} 个分集标记，覆盖比例约 ${Math.round(coverageRatio * 100)}%。`;
  if (userCount) return `用户填写 ${userCount} 集，检测到 ${detectedEpisodeCount} 集，覆盖比例约 ${Math.round(coverageRatio * 100)}%。`;
  return "未检测到足够分集标记，按片段或局部剧本处理。";
}
