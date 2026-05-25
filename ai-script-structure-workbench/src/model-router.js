import { normalizeApiConfig } from "./model-config.js";

const demoModelId = "model-demo-rule-engine";
const demoProviderId = "provider-demo-local";

export function selectModelRoute({
  state,
  apiConfig,
  project,
  taskType,
  featureArea,
  matchedSkills = [],
  routeOverride = {}
}) {
  const config = normalizeApiConfig(apiConfig || state?.apiConfig || {});
  const route = routeOverride.id ? routeOverride : findRoute(config.routes, taskType, featureArea);
  if (config.mode === "demo") {
    const demoModel = config.models.find((model) => model.id === demoModelId) || { id: demoModelId, displayName: "DemoRuleEngine-v1", modelName: "DemoRuleEngine-v1" };
    const demoProvider = config.providers.find((provider) => provider.id === demoProviderId) || { id: demoProviderId, name: "Demo Rule Engine", providerType: "local" };
    return createSelection({
      mode: "demo",
      route,
      model: demoModel,
      provider: demoProvider,
      reason: "当前处于 Demo Mode"
    });
  }
  const projectModelId = project?.modelOverrides?.taskModels?.[taskType] || project?.modelOverrides?.globalModelId || null;
  const skillPreferred = pickSkillPreferredModel(config, matchedSkills);
  const featureDefault = findRoute(config.routes, "*", featureArea)?.primaryModelId || null;
  const ordered = [
    { reason: "项目手动指定模型", modelId: projectModelId },
    { reason: "当前任务路由模型", modelId: route?.primaryModelId },
    { reason: "当前 Skill 推荐模型", modelId: skillPreferred },
    { reason: "功能区默认模型", modelId: featureDefault },
    { reason: "系统全局默认模型", modelId: config.globalDefaultModelId }
  ].filter((item) => item.modelId);

  for (const item of ordered) {
    const model = findUsableModel(config, item.modelId, matchedSkills);
    if (!model) continue;
    const provider = config.providers.find((candidate) => candidate.id === model.providerId && candidate.enabled);
    if (isDemoModel(model, provider)) {
      return createSelection({ mode: "demo", route, model, provider, reason: item.reason });
    }
    if (provider) {
      return createSelection({ mode: "api", route, model, provider, reason: item.reason });
    }
  }

  const demoModel = config.models.find((model) => model.id === demoModelId) || { id: demoModelId, displayName: "DemoRuleEngine-v1", modelName: "DemoRuleEngine-v1" };
  const demoProvider = config.providers.find((provider) => provider.id === demoProviderId) || { id: demoProviderId, name: "Demo Rule Engine", providerType: "local" };
  return createSelection({
    mode: "demo",
    route,
    model: demoModel,
    provider: demoProvider,
    reason: "没有可用真实模型，使用 DemoRuleEngine"
  });
}

export function selectFallbackModel({ config, route, failedModelId, matchedSkills = [] }) {
  const normalized = normalizeApiConfig(config);
  const fallbackIds = route?.fallbackModelIds || [];
  for (const modelId of fallbackIds) {
    if (modelId === failedModelId) continue;
    const model = findUsableModel(normalized, modelId, matchedSkills);
    if (!model || model.id === demoModelId) continue;
    const provider = normalized.providers.find((candidate) => candidate.id === model.providerId && candidate.enabled);
    if (provider) return { model, provider };
  }
  return null;
}

export function describeRouteSelection(selection) {
  return {
    mode: selection.mode,
    providerId: selection.provider?.id || null,
    modelId: selection.model?.id || null,
    routeId: selection.route?.id || null,
    reason: selection.routingReason,
    jsonModeRequired: Boolean(selection.options?.jsonModeRequired),
    fallbackModelIds: selection.fallbackModelIds || []
  };
}

function createSelection({ mode, route, model, provider, reason }) {
  return {
    mode,
    route,
    model,
    provider,
    routingReason: reason,
    usedFallback: false,
    fallbackModelIds: route?.allowFallback === false ? [] : route?.fallbackModelIds || [],
    options: {
      temperature: route?.temperature ?? 0.5,
      topP: route?.topP ?? 0.9,
      maxOutputTokens: route?.maxOutputTokens || model?.maxOutputTokens || 4096,
      jsonModeRequired: Boolean(route?.jsonModeRequired),
      streamingEnabled: Boolean(route?.streamingEnabled),
      retryCount: route?.retryCount || 0,
      timeoutMs: route?.timeoutMs || provider?.timeoutMs || 60000
    }
  };
}

function findRoute(routes = [], taskType, featureArea) {
  return (
    routes.find((route) => route.enabled && route.taskType === taskType && (!featureArea || route.featureArea === featureArea)) ||
    routes.find((route) => route.enabled && route.taskType === taskType) ||
    routes.find((route) => route.enabled && route.taskType === "*" && route.featureArea === featureArea) ||
    null
  );
}

function findUsableModel(config, modelId, matchedSkills) {
  const forbidden = new Set(matchedSkills.flatMap((skill) => skill.modelPreference?.forbiddenModelIds || []));
  if (forbidden.has(modelId)) return null;
  const model = config.models.find((candidate) => candidate.id === modelId && candidate.enabled);
  if (!model) return null;
  const provider = config.providers.find((candidate) => candidate.id === model.providerId);
  if (!provider?.enabled && model.id !== demoModelId) return null;
  const requiredCapabilities = matchedSkills.flatMap((skill) => skill.modelPreference?.requireCapabilities || []);
  if (!hasCapabilities(model, requiredCapabilities)) return null;
  return model;
}

function pickSkillPreferredModel(config, matchedSkills) {
  const sorted = [...matchedSkills].sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
  for (const skill of sorted) {
    for (const modelId of skill.modelPreference?.preferredModelIds || []) {
      if (findUsableModel(config, modelId, [skill])) return modelId;
    }
  }
  return null;
}

function hasCapabilities(model, requiredCapabilities = []) {
  return requiredCapabilities.every((capability) => {
    if (capability === "json") return model.supportsJsonMode;
    if (capability === "vision") return model.supportsVision;
    if (capability === "tools") return model.supportsTools;
    if (capability === "streaming") return model.supportsStreaming;
    return (model.modelType || []).includes(capability);
  });
}

function isDemoModel(model, provider) {
  return model?.id === demoModelId || provider?.providerType === "local" || model?.modelName === "DemoRuleEngine-v1";
}
