# 产品说明：AI 剧本结构学习与细纲生产系统 V1

## 产品定位

本系统面向内容公司老板、主编、责编、编剧、AI 剧本策划、短剧 / 漫剧项目负责人。

核心目标是把成功剧本拆解成可复用结构资产，再辅助创作者从创意生成可审计、可修复、可冻结、可导出的生产级细纲与成稿。

## 产品判断

系统不是“AI 根据创意随便写剧本”，而是：

```text
剧本结构学习系统
+ 模式沉淀系统
+ 创作决策系统
+ 细纲生产系统
+ 审计修复系统
+ 反馈进化系统
```

## V1 闭环

```text
剧本粘贴 / 上传
↓
结构化分析
↓
保存案例
↓
提炼可复用模式
↓
输入新创意
↓
生成方向、主题、大反差、结局方案
↓
人类锁定
↓
生成阶段大纲和分集细纲
↓
审计弱点
↓
局部修复
↓
导出 Markdown / JSON
```

## 六大中心

1. 剧本分析中心
2. 模式资产中心
3. Skill 进化中心
4. 创作决策中心
5. 细纲生产中心
6. 审计修复与反馈中心

## 关键设计原则

- 主题层决定故事满足观众什么情绪需求。
- 人物层承载主题。
- 情节最终为人物服务。
- 开头必须有钩子、反差、冲突、悬念或强欲望入口。
- 中后段应有主线级大反差或反套路。
- 金手指必须有规则、限制、代价和主题功能。
- 每集必须有开头钩子、核心冲突、人物功能、情绪功能、信息增量和结尾悬念。
- 审计必须独立于生成。
- AI 负责生成可能性，人类负责关键选择。
- 已锁定内容不得被后续生成擅自覆盖。
- Skill 更新必须可追踪、可验证、可回滚。

## 当前实现状态

本仓库内 V1 已实现可运行 Demo 闭环：

- 本地 Node 服务
- 无外部依赖前端
- 三栏工作台 UI
- Demo Model Adapter
- 结构化分析数据
- 案例与模式资产
- Skill 管理演示
- 锁定状态与版本记录
- 细纲生成
- 审计与局部修复
- 成稿生成
- Markdown / JSON 导出

## V1.1 可进化底座

本次升级在首版 Demo 闭环上补齐两个底层能力：

1. Skill 可编辑资产系统
2. API 与模型配置中心

目标不是推倒重来，而是让后续真实 API、真实团队方法论和项目级路由可以平滑接入。

## EditableSkill

Skill 从展示型记录升级为可编辑资产：

```js
EditableSkill = {
  id,
  name,
  description,
  category,
  skillType,
  genreScope,
  audienceNeedScope,
  platformScope,
  taskScope,
  priority,
  status,
  source,
  version,
  rules,
  positiveExamples,
  negativeExamples,
  promptAdditions,
  outputSchemaRef,
  evaluationCriteria,
  riskWarnings,
  modelPreference,
  createdBy,
  createdAt,
  updatedAt,
  lastTestAt,
  changelog
}
```

状态枚举：

```text
草稿 / 测试中 / 已启用 / 已停用 / 已归档
```

来源枚举：

```text
system / admin / ai_suggestion
```

分类支持：

```text
按功能 / 按题材 / 按观众情绪需求 / 全局
```

已实现操作：

```text
新增 Skill
编辑 Skill
复制 Skill
停用 / 启用 Skill
回滚 Skill
Demo 合并 Skill 入口
版本 changelog
```

## SkillModelPreference

```js
SkillModelPreference = {
  preferredModelIds,
  forbiddenModelIds,
  requireCapabilities,
  allowFallback,
  fallbackStrategy,
  notes
}
```

Skill 可以推荐模型、禁用模型、要求 JSON / vision / tools / streaming 等能力，并记录 fallback 策略。

## Skill 匹配

系统执行任务时不再只使用一个全局 Skill，而是通过：

```js
matchSkillsForTask({ taskType, featureArea, project, state })
```

匹配顺序：

```text
项目手动指定 Skill
→ 当前 taskType 对应 Skill
→ 当前题材对应 Skill
→ 当前观众情绪需求对应 Skill
→ 当前内容形态 / 平台 Skill
→ 全局基础 Skill
```

模型调用日志会记录：

```text
matchedSkillIds
skillConflicts
routingReason
```

## Skill 冲突

V1.1 增加简单冲突检测：

```js
SkillConflict = {
  skillA,
  skillB,
  conflictDescription,
  affectedTask,
  suggestedResolution,
  requiresAdminDecision
}
```

示例：

```text
短剧强爽 Skill 要求前期高频打脸。
情感宿命 Skill 要求前期保留情绪压抑和关系铺垫。
```

系统不允许静默忽略冲突，优先级为：

```text
项目锁定 Skill
→ 管理员手动指定 Skill
→ 当前任务 Skill
→ 题材 Skill
→ 情绪需求 Skill
```

## API Provider

```js
ApiProviderConfig = {
  id,
  name,
  providerType,
  requestFormat,
  baseUrl,
  apiKey,
  enabled,
  priority,
  defaultHeaders,
  timeoutMs,
  rateLimit,
  notes,
  createdAt,
  updatedAt
}
```

`requestFormat` 支持：

```text
auto / openai_chat / gemini_native
```

预留 Provider 类型：

```text
openai / anthropic / gemini / deepseek / qwen / zhipu / moonshot / doubao / openrouter / openai_compatible / local / custom
```

V1.1 已实现 OpenAI-compatible 和 Gemini native：

```text
POST {baseUrl}/chat/completions
POST {baseUrl}/models/{modelName}:generateContent
```

如果 `baseUrl` 已包含 `/chat/completions`，不会重复拼接。

`requestFormat` 判定规则：

```text
openai_chat：永远走 OpenAI-compatible Chat Completions，即使 modelName 包含 gemini。
gemini_native：才走 Gemini generateContent，不发送 messages / max_tokens。
auto：只有 providerType=gemini 或 baseUrl 明确为 generativelanguage.googleapis.com 时走 gemini_native；OpenAI 代理、DeepSeek、OpenRouter、OneAPI/NewAPI 默认 openai_chat。
```

真实任务不允许浏览器直连外部 Provider，统一经本地：

```text
POST /api/model-call
```

`/api/test-provider` 与 `/api/model-call` 必须共用同一套 Provider Adapter，并在日志记录 `endpointType=server_proxy`、`requestFormat`、`providerName`、`modelName`、`status` 与 `errorMessage`。

真实任务和 Provider 测试的浏览器请求体只允许携带 `providerId/modelId`、任务消息和路由参数；服务端必须从 `data/settings/model-settings.json` 读取真实 Provider、Model 和 API Key。刚编辑但未保存的 Provider 不允许直接测试，应提示“请先保存 Provider，再测试连接”。

快捷模板：

```text
DeepSeek 官方：providerType=deepseek，requestFormat=openai_chat，baseUrl=https://api.deepseek.com。
OpenAI-compatible 代理：providerType=openai_compatible，requestFormat=openai_chat，Base URL 和 Model Name 由用户填写。
```

## ModelConfig

```js
ModelConfig = {
  id,
  providerId,
  displayName,
  modelName,
  enabled,
  modelType,
  contextWindow,
  maxOutputTokens,
  supportsJsonMode,
  supportsJsonModeExplicit,
  supportsVision,
  supportsTools,
  supportsStreaming,
  costLevel,
  qualityLevel,
  recommendedTasks,
  notes
}
```

模型类型预留：

```text
text / vision / long_context / reasoning / fast / cheap / embedding / rerank / audio / video
```

质量等级：

```text
fast / balanced / high_quality / best
```

## FeatureModelRoute

```js
FeatureModelRoute = {
  id,
  featureArea,
  taskType,
  primaryModelId,
  fallbackModelIds,
  requiredCapabilities,
  maxInputTokens,
  maxOutputTokens,
  temperature,
  topP,
  jsonModeRequired,
  streamingEnabled,
  retryCount,
  timeoutMs,
  allowFallback,
  enabled,
  notes
}
```

每个 `taskType` 可以配置主模型、备用模型、JSON 模式、temperature、maxOutputTokens、重试次数、超时和 fallback。

`jsonModeRequired=true` 优先通过 Prompt 要求 JSON。OpenAI-compatible adapter 只有在用户明确勾选 `supportsJsonMode=true` 且记录 `supportsJsonModeExplicit=true` 时，才发送：

```js
response_format: { type: "json_object" }
```

## Model Router

新增：

```text
src/model-router.js
```

路由优先级：

```text
项目手动指定模型
→ 当前任务路由模型
→ 当前 Skill 推荐模型
→ 功能区默认模型
→ 系统全局默认模型
→ DemoRuleEngine
```

真实 API 失败时：

```text
不得静默切 Demo。
如果 fallbackModelIds 有可用真实模型，可切备用模型。
usedFallback 必须写入日志。
如果 API Mode 下最终选择 DemoRuleEngine，默认返回 requiresRouteFix=true 且不生成 Demo 内容；只有用户明确开启 allowDemoInApiMode 才允许继续。

V1.1 加固：

- Provider、Model、Route、API Mode 和“一键切换核心任务”保存后，前端必须等待 `/api/settings` 同步完成，并显示“配置已同步到本地服务”或“本地服务设置同步失败，测试连接可能读取旧配置”。
- `allowDemoInApiMode` 开启时需要二次确认；开启后页面顶部和调用日志必须以醒目警告标记“真实 API Mode 允许 Demo 兜底”。
- `requestFormat` 解析统一由 `src/request-format.js` 负责。`openai_chat` 永远走 Chat Completions，`gemini_native` 才走 Gemini native，`auto` 仅在 `providerType=gemini` 或 Base URL 为 `generativelanguage.googleapis.com` 时走 native，其余默认 `openai_chat`。
- retry 只对网络失败、超时、被中止、429、5xx、空响应等临时错误重试；结构校验失败、400 请求格式错误、缺少 Key、模型不属于 Provider 等配置或 schema 问题不做无意义重试。
- 基础状态里的“测试当前任务路由”应使用轻量路由探针，只验证 route/provider/model/requestFormat/server proxy 链路，不运行完整生产任务，避免把剧本分析误当连通性测试。
- `maxOutputTokens` 应按任务类型设置安全上限；当用户填写过大的输出上限时，实际发送给 Provider 的值需要被限制，并在 warnings / 调用日志中说明，避免 Provider 长时间推理或拒绝请求。
- Provider 类型为 `local` 时，测试连接结果必须标记为 Demo Provider 测试，不代表真实 API 可用。
- `/api/model-call` 与 `/api/test-provider` 服务端日志应记录 `taskType`、`routeId`、`providerId`、`providerName`、`modelId`、`modelName`、`requestFormat`、`endpointType`、`serverStatus`、`providerStatus`、`providerRawPreview`、`settingsUpdatedAt`、`providerUpdatedAt`、`latencyMs`、`errorMessage`，便于定位“配置已改但任务读到旧配置”的问题；日志不得记录 `apiKey`。
```

## Model Adapter

`src/model-adapter.js` 升级为统一入口：

```js
callModel({
  taskType,
  featureArea,
  projectId,
  skillIds,
  prompt,
  schema,
  inputMeta,
  routeOverride
})
```

返回：

```js
ModelCallResult = {
  success,
  mode,
  endpointType,
  requestFormat,
  taskType,
  providerId,
  modelId,
  usedFallback,
  requiresRouteFix,
  apiModeDemoFallback,
  settingsUpdatedAt,
  providerUpdatedAt,
  modelUpdatedAt,
  matchedSkillIds,
  outputText,
  parsedJson,
  error,
  latencyMs,
  tokenUsage,
  costEstimate,
  logId
}
```

保留 `runModelTask` 兼容现有 UI。

## JSON 修复

新增：

```text
src/json-repair.js
```

解析流程：

```text
直接 JSON.parse
→ 提取 JSON 代码块
→ 截取第一个 { 到最后一个 }
→ 调用 jsonRepair 任务
→ 明确报错
```

## 长剧本分集分析

V1.2 增加长剧本分析模式，避免完整 50 集剧本仍然依赖单次 `analyzeScript`。

触发条件：

```text
coverage.inputType === full_script 且 userEpisodeCount >= 5
detectedEpisodeCount >= 5
scriptText.length > LONG_SCRIPT_CHAR_LIMIT
用户勾选“确认这是完整剧本”且 episodeCount >= 5
```

新增任务类型：

```text
analyzeScriptChunk
analyzeEpisodeChunk
aggregateScriptAnalysis
mergeEvidenceLedAnalysis
```

执行流程：

```text
detectScriptCoverage
→ splitScriptIntoEpisodes
→ analyzeEpisodeChunk
→ aggregateScriptAnalysis
→ mergeEvidenceLedAnalysis / evidence validation
→ 标准 analyzeScript 分析档案
```

`analyzeEpisodeChunk` 只分析当前集，输出 `EpisodeChunkAnalysis`：

```js
{
  episodeNo,
  title,
  coverage,
  evidenceLedger,
  episodeBeatLedger,
  episodeFunctionAnalysis,
  hookAnalysis,
  characterMentions,
  goldfingerEvidence,
  suspenseEvidence,
  reusablePatterns,
  openQuestions,
  continuityNotes,
  confidence,
  needsReview
}
```

`aggregateScriptAnalysis` 只基于分集分析结果聚合，不重新编造原文证据。最终 `sourceMeta` 必须包含：

```js
{
  chunkedAnalysis: true,
  chunkCount,
  expectedChunks,
  detectedChunks,
  successfulChunks,
  participatingChunks,
  failedChunks,
  missingChunks,
  completeAggregation,
  needsReview,
  usableForFullScriptCase,
  usableForPatternExtraction,
  usableForProduction,
  usableForSkillLearning
}
```

如果用户声明 50 集但系统只切出 1 集，必须记录：

```js
sourceMeta.missingChunks = [
  { episodeNo: 2, title: "第2集未切出", detectedBy: "missing" }
]
sourceMeta.needsReview = true
sourceMeta.usableForFullScriptCase = false
sourceMeta.usableForSkillLearning = false
```

重试失败分集时，已成功分集结果必须保存在 `longScriptAnalysisProgress.chunkResults` 中，重试成功后替换对应 chunk，最终聚合使用所有成功 chunkResults，而不是只聚合本轮重试的分集。如果当前没有失败分集，不允许自动重跑全部 chunk；如果失败项只是全剧聚合失败，系统应保留已有 `chunkResults`，只重跑 `aggregateScriptAnalysis`。

`failedChunks` 应区分失败阶段：

```js
failureStage: "episode_chunk" | "aggregate"
```

所有路径（真实模型聚合成功、本地聚合兜底、聚合失败后兜底）都必须调用统一门禁：

```js
applyLongScriptGateFlags(finalAnalysis)
```

如果存在 `failedChunks`、`missingChunks` 或大量 primitive evidence 标准化，只能保存为待复核完整案例草稿，不允许进入正式完整案例、完整主线骨架、生产交付或 Skill 学习沉淀。

路由安全输出上限：

```text
analyzeScript: 12000
analyzeEpisodeChunk: 6000
aggregateScriptAnalysis: 12000
```

## 安全边界

- API Key 只允许本地运行时填写。
- 前端 password 输入框不长期明文展示完整 Key。
- 本地配置可进入 `localStorage` 与 `data/settings/`。
- `.gitignore` 排除 `.env`、`.env.*`、`config.local.json`、`data/settings/*.json`、`data/api-config*.json`、`data/model-config*.json`。
- `seed-data.js` 只包含 Demo Provider / Demo Model，不包含真实 Key。

## 后续扩展建议

1. 接入真实模型 API，并保留 `taskType`、输入摘要、输出摘要、耗时、错误日志。
2. 增加真实 txt / md / docx / pdf 解析器。
3. 把 Demo 规则抽象成可编辑 Skill 模板。
4. 增加项目级数据库或文件型 artifact store。
5. 增加可视化节奏图、人物关系图、主题 / 情绪曲线。
6. 增加团队协作和权限。
