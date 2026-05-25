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

## 模式说明

当前默认是 `Demo Mode`，使用本地规则引擎演示产品闭环。

它不会静默调用真实模型，也不会把 Demo 结果冒充真实 API 输出。

切到 `真实 API Mode` 后：

- 系统会通过 `model-router` 按项目覆盖、任务路由、Skill 模型偏好、功能区默认、全局默认模型选择模型。
- 真实 API 调用失败时不会静默切回 Demo。
- 只有路由中配置了可用备用真实模型时才会 fallback，并在调用日志中记录 `usedFallback`。
- 如果某个任务实际选择了 DemoRuleEngine，系统会在 UI、调用日志和 `ModelCallResult.warnings` 中提示：当前为真实 API Mode，但该任务路由仍指向 Demo 模型。
- 如果没有可用真实模型，系统会明确返回 `mode: "demo"` 的 DemoRuleEngine 结果，并附带 warning。

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
usedFallback    如果为 fallback，说明主模型失败后切到了备用模型
warning/error   不应出现“真实 API Mode ... Demo 模型”
```

也可以查看任务执行返回的 `ModelCallResult`：

```js
{
  mode: "api",
  providerId: "你的 Provider ID",
  modelId: "你的模型 ID",
  usedFallback: false,
  warnings: []
}
```

如果看到：

```text
当前为真实 API Mode，但该任务路由仍指向 Demo 模型。
```

说明这次任务没有走真实 API，需要到 `系统设置 → 路由配置` 把对应 `taskType` 的主模型改成真实模型。

## 配置 OpenAI-compatible API

在页面进入：

```text
系统设置 → API Provider
```

新增或编辑 Provider：

```text
Provider 类型：openai_compatible
Base URL：https://your-provider.example/v1
API Key：本地填写，不要提交
是否启用：勾选
```

Base URL 既可以填到 `/v1`，也可以直接填完整 `/chat/completions`；适配器会避免重复拼接。

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
src/provider-adapters/    Provider Adapter，V1 实现 OpenAI-compatible
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
