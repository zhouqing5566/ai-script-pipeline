# AI Script Studio - 安装与部署指南

## 系统要求
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

## 后端安装

### 1. 安装PostgreSQL
下载并安装PostgreSQL: https://www.postgresql.org/download/

创建数据库:
```bash
psql -U postgres
CREATE DATABASE ai_script_studio;
\q
```

### 2. 安装Redis
下载并安装Redis: https://redis.io/download

启动Redis服务:
```bash
redis-server
```

### 3. 配置后端环境

```bash
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境 (Windows)
venv\Scripts\activate

# 激活虚拟环境 (Linux/Mac)
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 复制环境变量文件
cp .env.example .env

# 编辑.env文件，填入你的API密钥和数据库配置
```

### 4. 初始化数据库

```bash
python init_db.py
```

### 5. 启动后端服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

访问 http://localhost:8000/docs 查看API文档

## 前端安装

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 启动前端服务

```bash
npm start
```

访问 http://localhost:3000

## 核心功能说明

### 1. 项目管理
- 创建新项目
- 输入核心创意、题材类型
- 管理多个IP项目

### 2. 流水线工作台
- **Step 1**: 生成大纲 (Agent 1)
- **Step 2**: 提取设定词典 (Agent 2)
- **Step 3**: 生成细纲 (Agent 3)
- **Step 4**: 并发生成分镜 (Agent 4)
- **Step 5**: 质检与导出 (Agent 5)

### 3. Agent控制台
- 管理5个核心Agent的提示词
- 支持版本控制和回滚
- 沙盒测试功能

## 并发控制说明

系统实现了严格的并发控制机制:

1. **令牌桶限流**: 最多5个并发请求
2. **指数退避重试**: 3秒 -> 9秒 -> 27秒
3. **超时保护**: 单任务最长5分钟
4. **隔离执行**: 每个分集任务独立运行

## API密钥配置

在 `.env` 文件中配置:

```env
# OpenAI API
OPENAI_API_KEY=sk-your-key-here

# 或使用Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

## 故障排查

### 数据库连接失败
检查PostgreSQL服务是否启动，数据库名称和密码是否正确

### API调用失败
检查API密钥是否正确配置，网络连接是否正常

### 前端无法连接后端
确保后端服务运行在8000端口，检查CORS配置

## 下一步开发

当前版本实现了核心架构和前两个Agent。后续需要完成:

1. Agent 3 (场次切片大师)
2. Agent 4 的并发调度逻辑
3. Agent 5 (质检与组装)
4. 完整的前端审核界面
5. 导出功能 (CSV/Word)

## 技术支持

如有问题，请查看项目文档或提交Issue。
