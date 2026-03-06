# 🚀 AI Script Studio - 快速参考

## 一键启动（需要先安装依赖）

### Windows
```bash
# 后端
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload

# 前端（新终端）
cd frontend
npm start
```

### Linux/Mac
```bash
# 使用启动脚本
chmod +x start.sh
./start.sh
```

## 核心URL

- 前端界面: http://localhost:3000
- 后端API: http://localhost:8000
- API文档: http://localhost:8000/docs
- 数据库: postgresql://localhost:5432/ai_script_studio

## 环境变量配置

编辑 `backend/.env`:

```env
# 必填项
OPENAI_API_KEY=sk-your-key-here
DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_script_studio

# 可选项
MAX_CONCURRENT_REQUESTS=5
API_RETRY_MAX_ATTEMPTS=3
TASK_TIMEOUT=300
```

## API快速测试

### 创建项目
```bash
curl -X POST http://localhost:8000/api/projects/ \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "测试项目",
    "genre": "奇幻",
    "core_premise": "一个普通人获得了穿越时空的能力"
  }'
```

### 生成大纲
```bash
curl -X POST http://localhost:8000/api/pipeline/generate-outline \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1}'
```

## 数据库操作

### 初始化数据库
```bash
cd backend
python init_db.py
```

### 连接数据库
```bash
psql -U postgres -d ai_script_studio
```

### 查看表
```sql
\dt
SELECT * FROM ip_projects;
SELECT * FROM pipeline_tasks;
```

## 故障排查

### 后端启动失败
1. 检查Python版本: `python --version` (需要3.11+)
2. 检查PostgreSQL: `pg_isready`
3. 检查依赖: `pip list`

### 前端启动失败
1. 检查Node版本: `node --version` (需要18+)
2. 清除缓存: `rm -rf node_modules && npm install`
3. 检查端口: `netstat -ano | findstr :3000`

### API调用失败
1. 检查API密钥是否配置
2. 查看后端日志
3. 测试网络连接: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`

## 开发技巧

### 热重载
- 后端: 使用 `--reload` 参数自动重启
- 前端: React自动热重载

### 调试
- 后端: 在代码中添加 `print()` 或使用 `pdb`
- 前端: 使用浏览器开发者工具

### 数据库迁移
```bash
# 使用Alembic（未来版本）
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## 项目文件说明

| 文件 | 说明 |
|------|------|
| README.md | 项目总览 |
| SETUP.md | 详细安装指南 |
| ARCHITECTURE.md | 架构设计文档 |
| backend/app/main.py | FastAPI入口 |
| backend/app/agents/ | Agent实现 |
| backend/app/models/database.py | 数据库模型 |
| frontend/src/pages/ | 前端页面 |

## 下一步开发

1. 完成Agent 3和Agent 5
2. 实现并发调度器
3. 添加Prompt版本管理UI
4. 实现导出功能（CSV/Word）
5. 添加用户认证
6. 部署到生产环境

## 技术支持

- 查看日志: `backend/logs/` 和浏览器控制台
- 阅读API文档: http://localhost:8000/docs
- 检查数据库状态: 使用pgAdmin或psql
