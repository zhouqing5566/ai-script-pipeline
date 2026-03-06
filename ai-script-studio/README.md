# AI Script Studio - 多Agent漫剧/短视频剧本创作系统

## 项目概述
基于大模型API的高度自动化AI剧本生产流水线，支持将创意转化为可直接驱动AI视频生成的分镜脚本。

## 技术栈
- **后端**: Python 3.11+, FastAPI, SQLAlchemy, PostgreSQL
- **前端**: React 18, TypeScript, Ant Design
- **AI集成**: OpenAI/Anthropic API
- **任务队列**: Celery + Redis

## 核心架构
- 5个专业Agent协同工作
- 串行逻辑控制 + 并发批量扩写
- 人工审核节点 (Human-in-the-loop)
- 严格的10-15秒镜头时长控制

## 快速开始

### 后端启动
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 前端启动
```bash
cd frontend
npm install
npm start
```

## 项目结构
```
ai-script-studio/
├── backend/           # FastAPI后端
│   ├── app/
│   │   ├── agents/    # 5个核心Agent
│   │   ├── api/       # API路由
│   │   ├── core/      # 核心配置
│   │   ├── models/    # 数据库模型
│   │   ├── schemas/   # Pydantic模型
│   │   └── services/  # 业务逻辑
│   └── tests/
└── frontend/          # React前端
    └── src/
        ├── components/
        ├── pages/
        └── services/
```
