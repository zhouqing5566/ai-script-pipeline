export const providerTypes = [
  "openai",
  "anthropic",
  "gemini",
  "deepseek",
  "qwen",
  "zhipu",
  "moonshot",
  "doubao",
  "openrouter",
  "openai_compatible",
  "local",
  "custom"
];

export const modelTypes = [
  "text",
  "vision",
  "long_context",
  "reasoning",
  "fast",
  "cheap",
  "embedding",
  "rerank",
  "audio",
  "video"
];

export const qualityLevels = ["fast", "balanced", "high_quality", "best"];

export const requestFormatTypes = ["auto", "openai_chat", "gemini_native"];

export const coreRouteTaskTypes = [
  "evaluateIdea",
  "generateDirections",
  "generateThemeCandidates",
  "generateMainlineReversals",
  "generateEndingCandidates",
  "generateMajorNodes",
  "analyzeScript",
  "generateMacroOutline",
  "generateStageOutline",
  "generateEpisodeOutline",
  "auditOutline",
  "generateDraft",
  "jsonRepair"
];

export const featureAreas = [
  "剧本分析中心",
  "模式资产中心",
  "Skill 进化中心",
  "创作决策中心",
  "细纲生产中心",
  "成稿中心",
  "审计与修复",
  "反馈回流",
  "JSON 修复",
  "分类与标签",
  "长文本总结"
];

export const modelTaskTypes = [
  "analyzeScript",
  "extractPatterns",
  "classifyCase",
  "generateSkillSuggestion",
  "testSkillVersion",
  "evaluateIdea",
  "generateDirections",
  "generateThemeCandidates",
  "generateMainlineReversals",
  "generateEndingCandidates",
  "generateMajorNodes",
  "generateMacroOutline",
  "generateCharacterCore",
  "generateGoldfinger",
  "generateStoryEngine",
  "generateMaterialPools",
  "generateStageOutline",
  "generateEpisodeOutline",
  "auditOutline",
  "repairSection",
  "generateDraft",
  "auditDraft",
  "jsonRepair",
  "summarizeLongText",
  "classifyTags"
];

export function createSeedApiConfig() {
  const now = new Date().toISOString();
  return normalizeApiConfig({
    mode: "demo",
    globalDefaultModelId: "model-demo-rule-engine",
    providers: [
      {
        id: "provider-demo-local",
        name: "Demo Rule Engine",
        providerType: "local",
        requestFormat: "auto",
        baseUrl: "",
        apiKey: "",
        enabled: true,
        priority: 1,
        defaultHeaders: {},
        timeoutMs: 15000,
        rateLimit: "本地规则引擎，无外部调用",
        notes: "首版 Demo 闭环使用，不冒充真实 API。",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "provider-openai-compatible-template",
        name: "OpenAI-compatible API 模板",
        providerType: "openai_compatible",
        requestFormat: "openai_chat",
        baseUrl: "https://api.example.com/v1",
        apiKey: "",
        enabled: false,
        priority: 10,
        defaultHeaders: {},
        timeoutMs: 60000,
        rateLimit: "按服务商控制台为准",
        notes: "填入真实 Base URL 和 API Key 后启用。不要提交本地密钥配置。",
        createdAt: now,
        updatedAt: now
      }
    ],
    models: [
      {
        id: "model-demo-rule-engine",
        providerId: "provider-demo-local",
        displayName: "DemoRuleEngine-v1",
        modelName: "DemoRuleEngine-v1",
        enabled: true,
        modelType: ["text", "fast"],
        contextWindow: 32000,
        maxOutputTokens: 12000,
        supportsJsonMode: true,
        supportsVision: false,
        supportsTools: false,
        supportsStreaming: false,
        costLevel: "free",
        qualityLevel: "balanced",
        recommendedTasks: modelTaskTypes,
        notes: "本地规则引擎，用于无真实 API 时保持可演示闭环。"
      },
      {
        id: "model-openai-compatible-default",
        providerId: "provider-openai-compatible-template",
        displayName: "OpenAI-compatible Chat Model",
        modelName: "your-model-name",
        enabled: false,
        modelType: ["text", "long_context"],
        contextWindow: 128000,
        maxOutputTokens: 8192,
        supportsJsonMode: false,
        supportsJsonModeExplicit: false,
        supportsVision: false,
        supportsTools: false,
        supportsStreaming: false,
        costLevel: "unknown",
        qualityLevel: "balanced",
        recommendedTasks: ["analyzeScript", "generateEpisodeOutline", "auditOutline", "jsonRepair"],
        notes: "替换为服务商真实模型名后启用。"
      }
    ],
    routes: createDefaultRoutes(),
    selectedProviderId: "provider-openai-compatible-template",
    selectedModelId: "model-openai-compatible-default",
    selectedRouteId: "route-generate-episode-outline",
    activeSettingsTab: "status",
    lastTestResult: null,
    updatedAt: now
  });
}

export function createDefaultRoutes() {
  return [
    {
      id: "route-analyze-script",
      featureArea: "剧本分析中心",
      taskType: "analyzeScript",
      primaryModelId: "model-demo-rule-engine",
      fallbackModelIds: [],
      requiredCapabilities: ["json"],
      maxInputTokens: 24000,
      maxOutputTokens: 12000,
      temperature: 0.35,
      topP: 0.9,
      jsonModeRequired: true,
      streamingEnabled: false,
      retryCount: 1,
      timeoutMs: 60000,
      allowFallback: true,
      enabled: true,
      notes: "剧本结构分析必须稳定返回 JSON。"
    },
    {
      id: "route-generate-episode-outline",
      featureArea: "细纲生产中心",
      taskType: "generateEpisodeOutline",
      primaryModelId: "model-demo-rule-engine",
      fallbackModelIds: [],
      requiredCapabilities: ["json"],
      maxInputTokens: 32000,
      maxOutputTokens: 16000,
      temperature: 0.55,
      topP: 0.92,
      jsonModeRequired: true,
      streamingEnabled: false,
      retryCount: 1,
      timeoutMs: 90000,
      allowFallback: true,
      enabled: true,
      notes: "分集细纲优先稳定和可审计。"
    },
    {
      id: "route-audit-outline",
      featureArea: "审计与修复",
      taskType: "auditOutline",
      primaryModelId: "model-demo-rule-engine",
      fallbackModelIds: [],
      requiredCapabilities: ["json"],
      maxInputTokens: 32000,
      maxOutputTokens: 10000,
      temperature: 0.2,
      topP: 0.85,
      jsonModeRequired: true,
      streamingEnabled: false,
      retryCount: 1,
      timeoutMs: 60000,
      allowFallback: true,
      enabled: true,
      notes: "审计任务温度较低，避免自夸。"
    },
    {
      id: "route-json-repair",
      featureArea: "JSON 修复",
      taskType: "jsonRepair",
      primaryModelId: "model-demo-rule-engine",
      fallbackModelIds: [],
      requiredCapabilities: ["json"],
      maxInputTokens: 12000,
      maxOutputTokens: 12000,
      temperature: 0,
      topP: 1,
      jsonModeRequired: true,
      streamingEnabled: false,
      retryCount: 0,
      timeoutMs: 30000,
      allowFallback: false,
      enabled: true,
      notes: "只修复 JSON，不扩写内容。"
    }
  ];
}

export function normalizeApiConfig(config = {}) {
  const seed = config.providers ? {} : createEmptyConfig();
  const merged = { ...seed, ...config };
  return {
    mode: merged.mode === "api" ? "api" : "demo",
    globalDefaultModelId: merged.globalDefaultModelId || "model-demo-rule-engine",
    providers: (merged.providers || []).map(normalizeProvider),
    models: (merged.models || []).map(normalizeModel),
    routes: (merged.routes || []).map(normalizeRoute),
    selectedProviderId: merged.selectedProviderId || merged.providers?.[0]?.id || "",
    selectedModelId: merged.selectedModelId || merged.models?.[0]?.id || "",
    selectedRouteId: merged.selectedRouteId || merged.routes?.[0]?.id || "",
    activeSettingsTab: merged.activeSettingsTab || "status",
    lastTestResult: merged.lastTestResult || null,
    routeTestTaskType: merged.routeTestTaskType || "analyzeScript",
    lastRouteTestResult: merged.lastRouteTestResult || null,
    updatedAt: merged.updatedAt || new Date().toISOString()
  };
}

export function normalizeProvider(provider = {}) {
  const now = new Date().toISOString();
  return {
    id: provider.id || createId("provider"),
    name: provider.name || "未命名 Provider",
    providerType: providerTypes.includes(provider.providerType) ? provider.providerType : "openai_compatible",
    requestFormat: requestFormatTypes.includes(provider.requestFormat) ? provider.requestFormat : "auto",
    baseUrl: provider.baseUrl || "",
    apiKey: provider.apiKey || "",
    enabled: Boolean(provider.enabled),
    priority: Number(provider.priority) || 50,
    defaultHeaders: provider.defaultHeaders || {},
    timeoutMs: Number(provider.timeoutMs) || 60000,
    rateLimit: provider.rateLimit || "",
    notes: provider.notes || "",
    createdAt: provider.createdAt || now,
    updatedAt: provider.updatedAt || now
  };
}

export function normalizeModel(model = {}) {
  const jsonModeWasExplicit = Boolean(model.supportsJsonModeExplicit);
  return {
    id: model.id || createId("model"),
    providerId: model.providerId || "",
    displayName: model.displayName || model.modelName || "未命名模型",
    modelName: model.modelName || "",
    enabled: Boolean(model.enabled),
    modelType: Array.isArray(model.modelType) ? model.modelType : [model.modelType || "text"],
    contextWindow: Number(model.contextWindow) || 32000,
    maxOutputTokens: Number(model.maxOutputTokens) || 4096,
    supportsJsonMode: jsonModeWasExplicit || model.id === "model-demo-rule-engine" ? Boolean(model.supportsJsonMode) : false,
    supportsJsonModeExplicit: jsonModeWasExplicit,
    supportsVision: Boolean(model.supportsVision),
    supportsTools: Boolean(model.supportsTools),
    supportsStreaming: Boolean(model.supportsStreaming),
    costLevel: model.costLevel || "unknown",
    qualityLevel: qualityLevels.includes(model.qualityLevel) ? model.qualityLevel : "balanced",
    recommendedTasks: Array.isArray(model.recommendedTasks) ? model.recommendedTasks : [],
    notes: model.notes || ""
  };
}

export function normalizeRoute(route = {}) {
  return {
    id: route.id || createId("route"),
    featureArea: route.featureArea || "创作决策中心",
    taskType: route.taskType || "evaluateIdea",
    primaryModelId: route.primaryModelId || "",
    fallbackModelIds: Array.isArray(route.fallbackModelIds) ? route.fallbackModelIds : [],
    requiredCapabilities: Array.isArray(route.requiredCapabilities) ? route.requiredCapabilities : [],
    maxInputTokens: Number(route.maxInputTokens) || 24000,
    maxOutputTokens: Number(route.maxOutputTokens) || 4096,
    temperature: Number.isFinite(Number(route.temperature)) ? Number(route.temperature) : 0.5,
    topP: Number.isFinite(Number(route.topP)) ? Number(route.topP) : 0.9,
    jsonModeRequired: Boolean(route.jsonModeRequired),
    streamingEnabled: Boolean(route.streamingEnabled),
    retryCount: Number(route.retryCount) || 0,
    timeoutMs: Number(route.timeoutMs) || 60000,
    allowFallback: route.allowFallback !== false,
    enabled: route.enabled !== false,
    notes: route.notes || ""
  };
}

export function maskApiKey(apiKey = "") {
  if (!apiKey) return "未填写";
  if (apiKey.length <= 8) return "********";
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
}

export function createProviderDraft() {
  const now = new Date().toISOString();
  return normalizeProvider({
    id: createId("provider"),
    name: "新的 OpenAI-compatible Provider",
    providerType: "openai_compatible",
    requestFormat: "openai_chat",
    baseUrl: "https://api.example.com/v1",
    enabled: false,
    priority: 50,
    timeoutMs: 60000,
    notes: "填入本地密钥后启用。密钥文件不会提交到 Git。apiKey: ",
    createdAt: now,
    updatedAt: now
  });
}

export function createModelDraft(providerId = "") {
  return normalizeModel({
    id: createId("model"),
    providerId,
    displayName: "新的聊天模型",
    modelName: "your-model-name",
    enabled: false,
    modelType: ["text"],
    supportsJsonMode: false,
    supportsJsonModeExplicit: false,
    qualityLevel: "balanced",
    recommendedTasks: ["analyzeScript", "generateEpisodeOutline"]
  });
}

export function createDeepSeekTemplate() {
  const now = new Date().toISOString();
  const provider = normalizeProvider({
    id: createId("provider"),
    name: "DeepSeek 官方",
    providerType: "deepseek",
    requestFormat: "openai_chat",
    baseUrl: "https://api.deepseek.com",
    enabled: false,
    priority: 20,
    timeoutMs: 60000,
    notes: "DeepSeek 官方 OpenAI-compatible 接口。填入 API Key 后启用。",
    createdAt: now,
    updatedAt: now
  });
  const modelNames = ["deepseek-v4-pro", "deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner"];
  const models = modelNames.map((modelName, index) =>
    normalizeModel({
      id: createId("model"),
      providerId: provider.id,
      displayName: modelName,
      modelName,
      enabled: true,
      modelType: index === 3 ? ["text", "reasoning"] : ["text"],
      contextWindow: 64000,
      maxOutputTokens: 8192,
      supportsJsonMode: false,
      supportsJsonModeExplicit: false,
      qualityLevel: index === 1 ? "fast" : "balanced",
      recommendedTasks: coreRouteTaskTypes,
      notes: "DeepSeek 模型默认不强制 response_format；如确认服务支持 JSON mode，可手动勾选。"
    })
  );
  return { provider, models };
}

export function createOpenAIProxyTemplate() {
  const now = new Date().toISOString();
  const provider = normalizeProvider({
    id: createId("provider"),
    name: "OpenAI-compatible 代理",
    providerType: "openai_compatible",
    requestFormat: "openai_chat",
    baseUrl: "https://your-proxy.example/v1",
    enabled: false,
    priority: 30,
    timeoutMs: 60000,
    notes: "适用于 OneAPI / NewAPI / OpenAI-compatible 代理站。Base URL 通常形如 https://xxx/v1。",
    createdAt: now,
    updatedAt: now
  });
  const model = normalizeModel({
    id: createId("model"),
    providerId: provider.id,
    displayName: "代理聊天模型",
    modelName: "your-model-name",
    enabled: true,
    modelType: ["text"],
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsJsonMode: false,
    supportsJsonModeExplicit: false,
    qualityLevel: "balanced",
    recommendedTasks: coreRouteTaskTypes,
    notes: "请填写代理站真实模型名。默认不发送 response_format，确认支持后再勾选 JSON。"
  });
  return { provider, models: [model] };
}

export function applyProviderTemplate(apiConfig, templateType) {
  const config = normalizeApiConfig(apiConfig || {});
  const template = templateType === "deepseek" ? createDeepSeekTemplate() : createOpenAIProxyTemplate();
  return normalizeApiConfig({
    ...config,
    providers: [template.provider, ...config.providers],
    models: [...template.models, ...config.models],
    selectedProviderId: template.provider.id,
    selectedModelId: template.models[0]?.id || config.selectedModelId,
    updatedAt: new Date().toISOString()
  });
}

export function switchCoreRoutesToModel(apiConfig, modelId) {
  const config = normalizeApiConfig(apiConfig || {});
  const byTask = new Map((config.routes || []).map((route) => [route.taskType, route]));
  const nextRoutes = [...(config.routes || [])];
  for (const taskType of coreRouteTaskTypes) {
    const existing = byTask.get(taskType);
    if (existing) {
      const index = nextRoutes.findIndex((route) => route.id === existing.id);
      nextRoutes[index] = normalizeRoute({
        ...existing,
        featureArea: existing.featureArea || featureAreaForTaskType(taskType),
        primaryModelId: modelId,
        enabled: true,
        allowFallback: existing.allowFallback !== false
      });
    } else {
      nextRoutes.push(
        normalizeRoute({
          id: createId("route"),
          featureArea: featureAreaForTaskType(taskType),
          taskType,
          primaryModelId: modelId,
          fallbackModelIds: [],
          requiredCapabilities: ["json"],
          jsonModeRequired: true,
          enabled: true,
          allowFallback: true,
          timeoutMs: defaultTimeoutForTask(taskType),
          maxOutputTokens: defaultMaxOutputForTask(taskType),
          notes: "一键切换核心任务时自动创建。"
        })
      );
    }
  }
  return normalizeApiConfig({
    ...config,
    mode: "api",
    globalDefaultModelId: modelId,
    routes: nextRoutes,
    updatedAt: new Date().toISOString()
  });
}

export function featureAreaForTaskType(taskType) {
  const map = {
    analyzeScript: "剧本分析中心",
    extractPatterns: "模式资产中心",
    classifyCase: "分类与标签",
    generateSkillSuggestion: "Skill 进化中心",
    testSkillVersion: "Skill 进化中心",
    evaluateIdea: "创作决策中心",
    generateDirections: "创作决策中心",
    generateThemeCandidates: "创作决策中心",
    generateMainlineReversals: "创作决策中心",
    generateEndingCandidates: "创作决策中心",
    generateMajorNodes: "创作决策中心",
    generateMacroOutline: "细纲生产中心",
    generateCharacterCore: "细纲生产中心",
    generateGoldfinger: "细纲生产中心",
    generateStoryEngine: "细纲生产中心",
    generateMaterialPools: "细纲生产中心",
    generateStageOutline: "细纲生产中心",
    generateEpisodeOutline: "细纲生产中心",
    auditOutline: "审计与修复",
    repairSection: "审计与修复",
    generateDraft: "成稿中心",
    auditDraft: "成稿中心",
    jsonRepair: "JSON 修复",
    summarizeLongText: "长文本总结",
    classifyTags: "分类与标签"
  };
  return map[taskType] || "创作决策中心";
}

export function createRouteDraft(modelId = "") {
  return normalizeRoute({
    id: createId("route"),
    featureArea: "创作决策中心",
    taskType: "evaluateIdea",
    primaryModelId: modelId,
    fallbackModelIds: [],
    requiredCapabilities: ["json"],
    jsonModeRequired: true,
    enabled: true
  });
}

function createEmptyConfig() {
  return {
    providers: [],
    models: [],
    routes: []
  };
}

function defaultTimeoutForTask(taskType) {
  if (taskType === "generateEpisodeOutline") return 90000;
  if (taskType === "jsonRepair") return 30000;
  return 60000;
}

function defaultMaxOutputForTask(taskType) {
  if (taskType === "generateEpisodeOutline") return 16000;
  if (taskType === "generateDraft") return 12000;
  return 10000;
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
