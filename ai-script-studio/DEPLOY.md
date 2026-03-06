# AI Script Studio - 火山云服务器部署指南

## 📋 部署前准备

### 1. 服务器要求
- **操作系统**: Ubuntu 20.04 LTS 或更高版本
- **配置建议**:
  - CPU: 2核心以上
  - 内存: 4GB以上
  - 硬盘: 40GB以上
- **网络**: 开放端口 80, 443, 8000（可选）

### 2. 本地准备
- 确保项目代码已提交到Git仓库（GitHub/GitLab/Gitee）
- 准备好OpenAI或Anthropic API密钥
- 记录数据库密码等敏感信息

## 🚀 部署步骤

### Step 1: 连接到火山云服务器

```bash
# 使用SSH连接（替换为你的服务器IP）
ssh root@your-server-ip

# 或使用火山云控制台的Web终端
```

### Step 2: 安装系统依赖

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y git curl wget vim build-essential

# 安装Python 3.11
sudo apt install -y software-properties-common
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3.11-dev

# 安装Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# 安装Redis
sudo apt install -y redis-server

# 安装Nginx
sudo apt install -y nginx
```

### Step 3: 配置PostgreSQL

```bash
# 切换到postgres用户
sudo -u postgres psql

# 在psql中执行以下命令
CREATE DATABASE ai_script_studio;
CREATE USER ai_script_user WITH PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE ai_script_studio TO ai_script_user;
\q

# 配置PostgreSQL允许密码认证
sudo vim /etc/postgresql/14/main/pg_hba.conf
# 找到以下行并修改为：
# local   all             all                                     md5

# 重启PostgreSQL
sudo systemctl restart postgresql
```

### Step 4: 配置Redis

```bash
# 启动Redis并设置开机自启
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 测试Redis
redis-cli ping
# 应该返回 PONG
```

### Step 5: 部署后端代码

```bash
# 创建应用目录
sudo mkdir -p /var/www/ai-script-studio
sudo chown $USER:$USER /var/www/ai-script-studio
cd /var/www/ai-script-studio

# 克隆代码（替换为你的仓库地址）
git clone https://github.com/your-username/ai-script-studio.git .

# 或者使用scp上传代码
# 在本地执行：scp -r ai-script-studio root@your-server-ip:/var/www/

# 配置后端
cd backend

# 创建虚拟环境
python3.11 -m venv venv
source venv/bin/activate

# 安装依赖
pip install --upgrade pip
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
vim .env
```

### Step 6: 配置后端环境变量

编辑 `/var/www/ai-script-studio/backend/.env`:

```env
# 数据库配置
DATABASE_URL=postgresql://ai_script_user:your_strong_password@localhost:5432/ai_script_studio

# Redis配置
REDIS_URL=redis://localhost:6379/0

# AI API密钥
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# 并发控制
MAX_CONCURRENT_REQUESTS=5
API_RETRY_MAX_ATTEMPTS=3
API_RETRY_BASE_DELAY=3

# 任务超时
TASK_TIMEOUT=300

# 生产环境配置
DEBUG=False
```

### Step 7: 初始化数据库

```bash
cd /var/www/ai-script-studio/backend
source venv/bin/activate
python init_db.py
```

### Step 8: 配置Gunicorn（生产级WSGI服务器）

```bash
# 安装Gunicorn
pip install gunicorn

# 创建Gunicorn配置文件
vim /var/www/ai-script-studio/backend/gunicorn_config.py
```

添加以下内容：

```python
# Gunicorn配置
bind = "127.0.0.1:8000"
workers = 4
worker_class = "uvicorn.workers.UvicornWorker"
timeout = 120
keepalive = 5
errorlog = "/var/log/ai-script-studio/gunicorn-error.log"
accesslog = "/var/log/ai-script-studio/gunicorn-access.log"
loglevel = "info"
```

创建日志目录：

```bash
sudo mkdir -p /var/log/ai-script-studio
sudo chown $USER:$USER /var/log/ai-script-studio
```

### Step 9: 配置Systemd服务（后端自动启动）

```bash
sudo vim /etc/systemd/system/ai-script-studio-backend.service
```

添加以下内容：

```ini
[Unit]
Description=AI Script Studio Backend
After=network.target postgresql.service redis.service

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/var/www/ai-script-studio/backend
Environment="PATH=/var/www/ai-script-studio/backend/venv/bin"
ExecStart=/var/www/ai-script-studio/backend/venv/bin/gunicorn app.main:app -c gunicorn_config.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
# 修改目录权限
sudo chown -R www-data:www-data /var/www/ai-script-studio

# 重载systemd配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start ai-script-studio-backend

# 设置开机自启
sudo systemctl enable ai-script-studio-backend

# 查看状态
sudo systemctl status ai-script-studio-backend

# 查看日志
sudo journalctl -u ai-script-studio-backend -f
```

### Step 10: 构建前端

```bash
cd /var/www/ai-script-studio/frontend

# 安装依赖
npm install

# 修改API地址（如果需要）
# 创建生产环境配置
echo "REACT_APP_API_URL=https://your-domain.com/api" > .env.production

# 构建生产版本
npm run build

# 构建完成后，静态文件在 build/ 目录
```

### Step 11: 配置Nginx

```bash
sudo vim /etc/nginx/sites-available/ai-script-studio
```

添加以下配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或IP

    # 前端静态文件
    location / {
        root /var/www/ai-script-studio/frontend/build;
        try_files $uri $uri/ /index.html;

        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # 后端API代理
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # API文档
    location /docs {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 日志
    access_log /var/log/nginx/ai-script-studio-access.log;
    error_log /var/log/nginx/ai-script-studio-error.log;
}
```

启用站点：

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/ai-script-studio /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx

# 设置开机自启
sudo systemctl enable nginx
```

### Step 12: 配置防火墙

```bash
# 如果使用ufw
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# 或使用火山云控制台配置安全组
# 开放端口: 22, 80, 443
```

### Step 13: 配置HTTPS（可选但推荐）

```bash
# 安装Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取SSL证书（替换为你的域名和邮箱）
sudo certbot --nginx -d your-domain.com -d www.your-domain.com --email your-email@example.com --agree-tos

# 自动续期
sudo systemctl enable certbot.timer
```

## 🔧 维护与管理

### 查看服务状态

```bash
# 后端服务
sudo systemctl status ai-script-studio-backend

# 查看后端日志
sudo journalctl -u ai-script-studio-backend -f
tail -f /var/log/ai-script-studio/gunicorn-error.log

# Nginx日志
tail -f /var/log/nginx/ai-script-studio-access.log
tail -f /var/log/nginx/ai-script-studio-error.log
```

### 重启服务

```bash
# 重启后端
sudo systemctl restart ai-script-studio-backend

# 重启Nginx
sudo systemctl restart nginx

# 重启PostgreSQL
sudo systemctl restart postgresql

# 重启Redis
sudo systemctl restart redis-server
```

### 更新代码

```bash
cd /var/www/ai-script-studio

# 拉取最新代码
git pull origin main

# 更新后端
cd backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart ai-script-studio-backend

# 更新前端
cd ../frontend
npm install
npm run build
sudo systemctl restart nginx
```

### 数据库备份

```bash
# 创建备份脚本
sudo vim /usr/local/bin/backup-ai-script-db.sh
```

添加以下内容：

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/ai-script-studio"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 备份数据库
pg_dump -U ai_script_user ai_script_studio > $BACKUP_DIR/db_backup_$DATE.sql

# 保留最近7天的备份
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/db_backup_$DATE.sql"
```

设置定时备份：

```bash
# 添加执行权限
sudo chmod +x /usr/local/bin/backup-ai-script-db.sh

# 添加到crontab（每天凌晨2点备份）
sudo crontab -e
# 添加以下行：
0 2 * * * /usr/local/bin/backup-ai-script-db.sh
```

## 🔍 故障排查

### 后端无法启动
```bash
# 查看详细错误
sudo journalctl -u ai-script-studio-backend -n 50

# 检查端口占用
sudo netstat -tlnp | grep 8000

# 手动测试
cd /var/www/ai-script-studio/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 数据库连接失败
```bash
# 测试数据库连接
psql -U ai_script_user -d ai_script_studio -h localhost

# 检查PostgreSQL状态
sudo systemctl status postgresql

# 查看PostgreSQL日志
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Nginx 502错误
```bash
# 检查后端是否运行
sudo systemctl status ai-script-studio-backend

# 检查Nginx配置
sudo nginx -t

# 查看Nginx错误日志
sudo tail -f /var/log/nginx/error.log
```

## 📊 性能优化

### 1. 数据库优化
```bash
# 编辑PostgreSQL配置
sudo vim /etc/postgresql/14/main/postgresql.conf

# 调整以下参数（根据服务器配置）
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
```

### 2. Redis优化
```bash
sudo vim /etc/redis/redis.conf

# 设置最大内存
maxmemory 512mb
maxmemory-policy allkeys-lru
```

### 3. Gunicorn优化
根据CPU核心数调整workers数量：
```python
# gunicorn_config.py
workers = (2 * cpu_count) + 1  # 例如4核心 = 9 workers
```

## 🔐 安全建议

1. **定期更新系统**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **配置fail2ban防止暴力破解**
   ```bash
   sudo apt install -y fail2ban
   sudo systemctl enable fail2ban
   ```

3. **使用强密码**
   - 数据库密码至少16位
   - 定期更换API密钥

4. **限制SSH访问**
   ```bash
   # 禁用root登录
   sudo vim /etc/ssh/sshd_config
   # 设置: PermitRootLogin no
   ```

5. **监控日志**
   定期检查异常访问和错误日志

## 📞 技术支持

部署完成后访问：
- 前端: http://your-domain.com
- API文档: http://your-domain.com/docs
- 健康检查: http://your-domain.com/api/health

如遇问题，请检查日志文件并参考故障排查部分。
