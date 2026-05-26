const missingRelationLabel = "关系对象缺失，需复核";

export function normalizeRelationshipEdge(edge = {}) {
  const from = firstValue(edge, ["from", "source", "characterA", "subject", "left", "nameA"]);
  const to = firstValue(edge, ["to", "target", "characterB", "object", "right", "nameB"]);
  if (!from && !to) return null;
  return {
    ...edge,
    from: from || missingRelationLabel,
    to: to || missingRelationLabel,
    conflict: firstValue(edge, ["conflict", "tension", "contradiction", "relationshipConflict"]) || edge.conflict || "",
    relationshipShift: firstValue(edge, ["relationshipShift", "shift", "change", "relationshipChange"]) || edge.relationshipShift || "",
    themeFunction: edge.themeFunction || edge.function || edge.role || ""
  };
}

function firstValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
