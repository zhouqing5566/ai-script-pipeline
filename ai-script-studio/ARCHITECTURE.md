# AI Script Studio - 项目架构说明

## 📁 项目结构

```
ai-script-studio/
├── backend/                    # Python FastAPI后端
│   ├── app/
│   │   ├── agents/            # 5个核心Agent
│   │   │   ├── base_agent.py      # Agent基类（并发控制+重试）
│   │   │   ├── agent_outline.py   # Agent 1: 总控编剧
│   │   │   ├── agent_settings.py  # Agent 2: 视觉架构师
│   │   │   └── agent_storyboard.py # Agent 4: 分镜执笔
│   │   ├── api/               # API路由
│   │   │   ├── projects.py        # 项目管理API
│   │   │   ├── agents.py          # Agent配置API
│   │   │   └── pipeline.py        # 流水线编排API
│   │   ├── core/              # 核心配置
│   │   │   ├── config.py          # 应用配置
│   │   │   └── database.py        # 数据库连接
│   │   ├── models/            # 数据库模型
│   │   │   └── database.py        # SQLAlchemy模型
│   │   ├── schemas/           # Pydantic模型
│   │   ├── services/          # 业务逻辑
│   │   └── main.py            # FastAPI应用入口
│   ├── requirements.txt       # Python依赖
│   ├── .env.example          # 环境变量模板
│   └── init_db.py            # 数据库初始化脚本
│
├── frontend/                  # React TypeScript前端
│   ├── src/
│   │   ├── components/       # 可复用组件
│   │   ├── pages/            # 页面组件
│   │   │   ├── ProjectList.tsx        # 项目列表
│   │   │   ├── PipelineWorkbench.tsx  # 流水线工作台
│   │   │   └── AgentConsole.tsx       # Agent控制台
│   │   ├── services/         # API服务
│   │   ├── types/            # TypeScript类型定义
│   │   ├── App.tsx           # 应用主组件
│   │   └── index.tsx         # 应用入口
│   ├── public/
│   ├── package.json          # npm依赖
│   └── tsconfig.json         # TypeScript配置
│
├── README.md                 # 项目说明
├── SETUP.md                  # 安装部署指南
├── .gitignore               # Git忽略文件
└── start.sh                 # 快速启动脚本

## 🏗️ 系统架构

### 数据流转

```
用户输入创意
    ↓
Agent 1: 生成大纲
    ↓
人工审核 ✋
    ↓
Agent 2: 提取设定词典
    ↓
人工审核 ✋
    ↓
Agent 3: 生成细纲（多集）
    ↓
人工审核 ✋
    ↓
Agent 4: 并发生成分镜 ⚡ (Fan-out)
    ├─ 第1集 →
    ├─ 第2集 →
    ├─ 第3集 →
    └─ 第N集 →
    ↓
Agent 5: 质检与组装 (Fan-in)
    ↓
导出CSV/Word
```

### 核心技术特性

1. **并发控制**
   - 令牌桶限流（Semaphore）
   - 最大5个并发请求
   - 防止API熔断

2. **重试机制**
   - 指数退避：3s → 9s → 27s
   - 最多重试3次
   - 自动处理429/503错误

3. **数据一致性**
   - 全局设定词典常驻
   - episode_index强绑定
   - 异步任务追踪

4. **时长控制**
   - 每个镜头10-15秒
   - 自动验证超长镜头
   - 不合格自动重写

## 🎯 核心Agent说明

### Agent 1 - 总控编剧
- **输入**: 核心创意、题材类型
- **输出**: 整体大纲JSON（包含分集概要）
- **模型**: GPT-4 (temperature=0.7)

### Agent 2 - 视觉架构师
- **输入**: 大纲数据
- **输出**: 设定词典JSON（角色视觉标签、场景描述）
- **模型**: GPT-4 (temperature=0.5)

### Agent 3 - 场次切片大师
- **输入**: 大纲 + 设定词典
- **输出**: 多集细纲数组（带并发锚点）
- **特性**: 必须包含ending_hook和starting_scene

### Agent 4 - 分镜执笔
- **输入**: 设定词典 + 单集细纲
- **输出**: 分镜JSON数组（镜号、画面、台词、时长）
- **特性**: 支持并发执行，严格时长控制

### Agent 5 - 场记审核
- **输入**: 所有分镜数据（异步）
- **输出**: 质检通过的完整分镜
- **特性**: 自动拦截违规，按episode_index排序

## 🗄️ 数据库表结构

### agent_prompt_templates
Agent提示词配置表，支持版本管理和热更新

### ip_projects
项目主表，存储核心创意和全局设定

### pipeline_tasks
流水线任务表，记录每个阶段的输出数据

### task_episodes_tracking
分集并发追踪表，监控每集的生成状态

### storyboard_segments
最终分镜产出表，存储可导出的分镜数据

## 🚀 快速开始

详见 SETUP.md

## 📝 开发状态

✅ 已完成:
- 项目基础架构
- 数据库模型设计
- Agent基类（并发+重试）
- Agent 1, 2, 4实现
- 基础API接口
- 前端项目列表和工作台

🚧 待完成:
- Agent 3 (场次切片)
- Agent 5 (质检组装)
- 完整的并发调度器
- 前端审核界面优化
- 导出功能
- Prompt版本管理UI
