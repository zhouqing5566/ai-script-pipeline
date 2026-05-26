# AI 剧本结构学习与细纲生产系统

面向 AI 漫剧、短剧、网文改编和爽剧内容生产的本地结构化工作台。

这个 V1 不是聊天框式写稿工具，而是一个可运行的生产流程：

```text
剧本分析
→ 案例库保存
→ 模式资产沉淀
→ 创作决策
→ 人类锁定关键锚点
→ 宏观结构与分集细纲
→ 独立审计
→ 局部修复
→ 成稿与导出
```

## 功能范围

- 剧本粘贴 / 上传入口，支持 txt / md / docx 正文解析
- 结构化剧本分析：开头钩子、观众情绪、主题、人物、金手指、阻碍、主线骨架、大反差、结局、分集功能、可复用模式
- 案例库与模式资产中心
- Skill 版本管理、优化建议、回归对比演示
- 创作决策：创意评估、5 类方向方案、主题与情绪、主线大反差、结局、大节点
- 锁定机制：方向、主题、大反差、结局、大节点、人物核心、金手指、故事发动机、阶段大纲、分集细纲、成稿
- 细纲生产：宏观结构、人物核心、金手指、故事发动机、素材池、阶段大纲、分集细纲
- 审计系统：主题、人物、主线大反差、情绪兑现、分集功能
- 局部修复：针对弱集输出修复前后差异、影响范围和风险
- 成稿中心：基于已生成分集细纲输出单集剧本文本
- 反馈回流：记录人工修改、主编评价、成稿反馈和上线数据
- 导出：完整项目 JSON、剧本分析 Markdown、分集细纲 Markdown、人物小传 Markdown、审计报告 Markdown、成稿 Markdown
- Skill 可编辑资产系统：新增、编辑、复制、停用、启用、回滚、Demo 合并入口、版本记录、适用范围、规则、Prompt 补充、正反例、评估标准、风险提示、模型偏好
- API 与模型配置中心：多 Provider、多模型、任务路由、功能区路由、Skill 模型偏好、项目级覆盖预留、备用模型、调用日志、安全说明
- 长剧本分集分析：完整 5 集以上或长文本剧本会自动切换为“分集/切块分析 → 全剧聚合 → 证据校验”，不再依赖单次超大 `analyzeScript`

## 运行方式

```bash
npm run dev
```

默认地址：

```text
http://127.0.0.1:4178
```

健康检查：

```bash
curl http://127.0.0.1:4178/api/health
```

## 验证

```bash
npm run check
```

该检查会验证：

- 剧本分析字段完整
- 创作决策生成 5 个方向、3 个主线大反差
- 宏观结构、5 阶段大纲、24 集细纲生成
- 审计能识别“该集事件成立，但人物变化不足”
- 局部修复能补人物、主题和关系变化
- 成稿与 Markdown 导出可用
- 导出内容不泄漏机器字段名
- EditableSkill 关键字段、Skill 编辑状态逻辑和 matchSkillsForTask
- ApiProviderConfig / ModelConfig / FeatureModelRoute 与 model-router
- callModel 返回统一 ModelCallResult
- Demo Mode 仍然可用
- .gitignore 排除本地 API Key 与模型配置
- API Mode 误走 Demo 会在 UI / 日志 / ModelCallResult 中警告
- 主模型失败、备用模型失败、JSON 修复失败都会返回完整结果并写日志
- 完整项目导出和快照不会泄漏 API Key
- 真实 API JSON 返回会按 taskType 做结构校验
- docx 上传会解析 Word 正文，不再按二进制文本读取造成乱码
- 真实 API 调用经过本地 `/api/model-call` server proxy，不从浏览器直连外部 Provider
- `requestFormat=openai_chat` 时即使模型名包含 Gemini 也走 OpenAI-compatible
- DeepSeek 模板默认 `requestFormat=openai_chat`
- 新建模型默认不发送 `response_format`，除非用户明确勾选 JSON 支持
- 完整剧本 5 集以上会走长剧本分析管线，检查分集切分、失败 chunk 标记、全剧聚合、Skill 学习沉淀门禁

## 模式说明

当前默认是 `Demo Mode`，使用本地规则引擎演示产品闭环。

它不会静默调用真实模型，也不会把 Demo 结果冒充真实 API 输出。

切到 `真实 API Mode` 后：

- 系统会通过 `model-router` 按项目覆盖、任务路由、Skill 模型偏好、功能区默认、全局默认模型选择模型。
- 真实任务统一请求本地 `/api/model-call`，由 Node 服务端代理外部 Provider，减少 CORS / Failed to fetch 问题。
- `/api/model-call` 与 `/api/test-provider` 的真实路径只从前端接收 `providerId/modelId`，服务端再从 `data/settings/model-settings.json` 读取真实 Key，避免把完整 Provider 和 API Key 放进任务请求体。
- 保存 Provider、模型、路由、API Mode 或“一键切换核心任务”后，前端会等待 `/api/settings` 同步完成；看到“配置已同步到本地服务”后再测试，能避免服务端读取旧配置。
- 系统会按任务类型限制过大的 `maxOutputTokens`，避免把 `200000` 这类输出上限直接发给 Provider 导致长任务超时；调用日志会记录对应警告。
- 路由保存时也会提前按安全上限 clamp：`analyzeScript=12000`、`analyzeEpisodeChunk=6000`、`aggregateScriptAnalysis=12000`。完整剧本不会靠单次超大输出完成，而是自动进入分集分析流程。
- 真实 API 调用失败时不会静默切回 Demo。
- 只有路由中配置了可用备用真实模型时才会 fallback，并在调用日志中记录 `usedFallback`。
- 如果某个任务实际选择了 DemoRuleEngine，系统会在 UI、调用日志和 `ModelCallResult.warnings` 中提示：当前为真实 API Mode，但该任务路由仍指向 Demo 模型。
- 默认情况下，真实 API Mode 命中 Demo 路由会返回失败和 `requiresRouteFix=true`，不会继续生成 Demo 结果；只有手动二次确认开启“API Mode 允许 Demo 兜底”才会继续使用 DemoRuleEngine，页面和调用日志会标记 `API Mode + Demo 兜底`。
- Provider 类型为 `local` 时，“测试连接”只代表本地 Demo Provider 可用，页面会明确显示“这是 Demo Provider 测试，不代表真实 API 可用”。

## 确认某次任务是否使用了真实 API

进入：

```text
系统设置 → 调用日志
```

检查最近一条任务日志：

```text
mode            应为 api
provider        应为你配置的真实 Provider
model           应为真实模型，而不是 DemoRuleEngine-v1
requestFormat   应匹配端点：openai_chat 或 gemini_native
endpointType     应为 server_proxy
usedFallback    如果为 fallback，说明主模型失败后切到了备用模型
warning/error   不应出现“真实 API Mode ... Demo 模型”
settingsUpdatedAt 可辅助判断本次任务是否读到了最新同步配置
不要出现 API Mode + Demo 兜底
```

如果看到 `API Mode + Demo 兜底`，说明这次不是完整真实 API 调用。

也可以查看任务执行返回的 `ModelCallResult`：

```js
{
  mode: "api",
  endpointType: "server_proxy",
  requestFormat: "openai_chat",
  providerId: "你的 Provider ID",
  modelId: "你的模型 ID",
  usedFallback: false,
  requiresRouteFix: false,
  warnings: []
}
```

如果看到：

```text
当前为真实 API Mode，但该任务路由仍指向 Demo 模型。
```

说明这次任务没有走真实 API，需要到 `系统设置 → 路由配置` 把对应 `taskType` 的主模型改成真实模型。

也可以在：

```text
系统设置 → 基础状态 → 测试当前任务路由
```

选择 `taskType` 后进行轻量路由探针测试。它只验证实际路由、Provider、模型、请求格式和 server proxy 链路，不会运行完整剧本分析。若提示任务仍指向 Demo，点击“一键切换核心任务到当前真实模型”。

如果 Provider 测试通过，但完整剧本分析仍超时，优先检查该任务路由的 `maxOutputTokens` 和 `timeoutMs`。`deepseek-v4-pro` 等推理模型在长 JSON 任务上可能明显慢于普通 chat/flash 模型，建议先用轻量路由测试确认链路，再把生产任务切到更快模型或提高超时。

Provider 测试也会走服务端 settings：如果刚修改了 Base URL、API Key、启用状态或请求格式，请先点击“保存 Provider”，再点击“测试连接”。测试连接不会退回去拿 Demo 模型冒充当前 Provider 的结果；当前 Provider 下没有启用模型时会直接报错。

## 长剧本分析流程

当满足以下任一条件时，系统不会直接发起单次 `analyzeScript`：

```text
coverage.inputType = full_script 且用户声明集数 >= 5
系统检测集数 >= 5
剧本文本超过 LONG_SCRIPT_CHAR_LIMIT
用户勾选“确认这是完整剧本”且集数 >= 5
```

流程会变成：

```text
detectScriptCoverage
→ splitScriptIntoEpisodes
→ analyzeEpisodeChunk 逐集/逐 chunk 分析
→ aggregateScriptAnalysis 全剧聚合
→ evidence/sourceText 校验
→ 标准 analyzeScript 分析档案
```

分析页会显示“长剧本分析进度”，包括覆盖检测、剧本切分、每集状态、token 估算、失败原因、“重试失败分集”和“重试全剧聚合”。系统会同时显示声明/预期 chunk、系统实际切出 chunk、成功分析 chunk、失败 chunk、缺失分集和参与聚合数量。

失败 chunk 不会被静默跳过；成功 chunk 会保存到 `longScriptAnalysisProgress.chunkResults`，所以点击“重试失败分集”时不会丢失上一轮已经成功的分集结果。如果当前没有失败分集，系统不会误把“重试失败分集”降级成全量重跑；如果只是聚合失败，可以只重跑 `aggregateScriptAnalysis`。如果用户声明 50 集但系统只切出 1 集，`sourceMeta.missingChunks` 会记录缺失分集，并提示“仅切出 1/50 集，不能视为完整剧本分析完成”。

最终结果会写入 `sourceMeta.failedChunks` / `sourceMeta.missingChunks`，并统一通过 `applyLongScriptGateFlags` 重算 `usableForFullScriptCase`、`usableForProduction`、`usableForPatternExtraction`、`usableForSkillLearning`。只要存在失败 chunk、缺失分集或 primitive evidence 标准化，结果只能保存为待复核草稿，不允许进入正式完整案例或 Skill 学习沉淀。

## 配置 OpenAI-compatible API

在页面进入：

```text
系统设置 → API Provider
```

新增或编辑 Provider：

```text
Provider 类型：openai_compatible
请求格式：openai_chat
Base URL：https://your-provider.example/v1
API Key：本地填写，不要提交
是否启用：勾选
```

Base URL 既可以填到 `/v1`，也可以直接填完整 `/chat/completions`；适配器会避免重复拼接。

DeepSeek 官方可直接使用页面里的“DeepSeek 官方模板”：

```text
Provider 类型：deepseek
请求格式：openai_chat
Base URL：https://api.deepseek.com
推荐模型：deepseek-v4-pro / deepseek-v4-flash / deepseek-chat / deepseek-reasoner
```

OpenAI-compatible 代理可使用“OpenAI 代理模板”：

```text
Provider 类型：openai_compatible
请求格式：openai_chat
Base URL：通常为 https://xxx/v1
Model Name：按代理站要求填写
支持 JSON：默认关闭，确认代理支持 response_format 后再打开
```

如果你使用的是 Gemini native 接口，或看到类似下面的错误：

```text
Invalid JSON payload received. Unknown name "messages": Cannot find field.
```

说明当前端点不接受 OpenAI chat/completions 的 `messages` 请求体。请这样配置：

```text
Provider 类型：gemini
请求格式：gemini_native
Base URL：https://generativelanguage.googleapis.com/v1beta
API Key：本地填写
真实模型名：gemini-3.1-flash-lite-preview 或你的服务商模型名
```

如果第三方网关虽然模型名包含 `gemini`，但它明确兼容 `/chat/completions`，则把请求格式改为 `openai_chat`。

然后进入：

```text
系统设置 → 模型列表
```

新增或编辑模型：

```text
Provider：选择上一步 Provider
真实模型名：服务商要求的 model 名称
支持 JSON：按模型能力勾选
是否启用：勾选
```

注意：`强制 JSON` 路由会通过 Prompt 要求模型输出 JSON；只有模型配置里明确勾选“支持 JSON”后，OpenAI-compatible adapter 才会额外发送 `response_format: { type: "json_object" }`。

最后进入：

```text
系统设置 → 路由配置
```

给任务绑定模型，例如：

```text
功能区：细纲生产中心
任务类型：generateEpisodeOutline
主模型：你的真实模型
备用模型：可填其他模型 ID，逗号或顿号分隔
强制 JSON：勾选
允许 fallback：勾选
```

## Skill 绑定模型偏好

进入：

```text
Skill 进化 → 选择 Skill → 模型偏好
```

可填写：

```text
推荐模型 ID：model-openai-compatible-default
禁用模型 ID：不希望该 Skill 使用的模型
必需能力：json、vision、tools、streaming 或模型类型
允许 fallback：勾选或取消
Fallback 策略：补充人工说明
```

模型路由优先级：

```text
项目手动指定模型
→ 当前任务路由模型
→ 当前 Skill 推荐模型
→ 功能区默认模型
→ 系统全局默认模型
→ DemoRuleEngine
```

## 安全提示

- 不要把真实 API Key 写入 `seed-data.js`、README 示例或任何提交文件。
- 前端输入框使用 password，不长期明文展示完整 API Key。
- 本地保存仅用于本机运行，可能进入 `localStorage` 和 `data/settings/`。
- 真实模型调用和 Provider 测试请求体不携带完整 Provider/API Key，只携带 `providerId/modelId`；保存设置时才会把 Key 写入本机运行时配置。
- 启动时会自动从 `data/settings/model-settings.json` 恢复有用的 API/模型配置，换端口后也能带回服务端保存的配置。
- “重置 Demo 数据”只重置项目 Demo 状态，会保留 API Provider、模型和路由配置。
- `data/projects/current-snapshot.json` 和完整项目导出会脱敏 `apiKey`，真实 Key 只保留在本机 localStorage / `data/settings/`。
- `.gitignore` 已排除 `.env`、`config.local.json`、`data/settings/*.json`、`data/api-config*.json`、`data/model-config*.json`。

## 目录结构

```text
server.js                 本地 Node 服务与导出接口
index.html                应用入口
src/app.js                三栏工作台 UI 与交互
src/generators.js         Demo 结构分析、决策和细纲生成
src/audit.js              独立审计逻辑
src/repair.js             局部修复逻辑
src/export.js             Markdown / JSON 导出
src/model-adapter.js      统一 callModel 入口、Demo / API 调用与日志
src/model-router.js       任务路由、Skill 模型偏好和 fallback 选择
src/model-config.js       Provider / Model / Route 数据结构与种子配置
src/skill-manager.js      EditableSkill、编辑状态、匹配、冲突检测
src/prompt-builder.js     通用系统原则、锁定锚点和 Skill 规则拼装
src/json-repair.js        JSON 解析与修复流程
src/provider-adapters/    服务端 Provider Adapter，V1.1 实现 OpenAI-compatible 与 Gemini native
src/file-parser.js        txt / md / docx 上传解析，避免 Word 二进制乱码
src/schemas.js            导航、枚举、中文字段标签
src/seed-data.js          Demo 项目、案例、模式资产、Skill、Demo 模型配置
src/storage.js            localStorage 与本地快照持久化
src/styles.css            工作台样式系统
scripts/check.mjs         无依赖 smoke check
```

## 数据与导出

运行时数据默认写入：

```text
data/projects/
data/settings/
data/logs/
data/exports/
```

这些运行产物默认不提交到仓库。
