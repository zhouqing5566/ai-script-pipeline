#!/bin/bash

# AI Script Studio - 服务器自动部署脚本
# 在火山云服务器上运行此脚本

set -e  # 遇到错误立即退出

echo "=================================="
echo "AI Script Studio 自动部署脚本"
echo "=================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用root权限运行此脚本${NC}"
    echo "使用: sudo bash deploy.sh"
    exit 1
fi

# 获取用户输入
read -p "请输入数据库密码: " DB_PASSWORD
read -p "请输入OpenAI API Key: " OPENAI_KEY
read -p "请输入域名或IP地址: " DOMAIN
read -p "请输入Git仓库地址 (留空则跳过): " GIT_REPO

echo ""
echo -e "${GREEN}开始部署...${NC}"

# 1. 更新系统
echo -e "${YELLOW}[1/12] 更新系统...${NC}"
apt update && apt upgrade -y

# 2. 安装基础工具
echo -e "${YELLOW}[2/12] 安装基础工具...${NC}"
apt install -y git curl wget vim build-essential software-properties-common

# 3. 安装Python 3.11
echo -e "${YELLOW}[3/12] 安装Python 3.11...${NC}"
add-apt-repository ppa:deadsnakes/ppa -y
apt update
apt install -y python3.11 python3.11-venv python3.11-dev

# 4. 安装Node.js 18
echo -e "${YELLOW}[4/12] 安装Node.js 18...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 5. 安装PostgreSQL
echo -e "${YELLOW}[5/12] 安装PostgreSQL...${NC}"
apt install -y postgresql postgresql-contrib

# 配置PostgreSQL
sudo -u postgres psql -c "CREATE DATABASE ai_script_studio;" 2>/dev/null || echo "数据库已存在"
sudo -u postgres psql -c "CREATE USER ai_script_user WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || echo "用户已存在"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ai_script_studio TO ai_script_user;"

# 6. 安装Redis
echo -e "${YELLOW}[6/12] 安装Redis...${NC}"
apt install -y redis-server
systemctl start redis-server
systemctl enable redis-server

# 7. 安装Nginx
echo -e "${YELLOW}[7/12] 安装Nginx...${NC}"
apt install -y nginx

# 8. 部署代码
echo -e "${YELLOW}[8/12] 部署代码...${NC}"
mkdir -p /var/www/ai-script-studio
cd /var/www/ai-script-studio

if [ -n "$GIT_REPO" ]; then
    echo "从Git克隆代码..."
    git clone $GIT_REPO .
else
    echo -e "${YELLOW}跳过Git克隆，请手动上传代码到 /var/www/ai-script-studio${NC}"
    read -p "代码已上传？按Enter继续..."
fi

# 9. 配置后端
echo -e "${YELLOW}[9/12] 配置后端...${NC}"
cd /var/www/ai-script-studio/backend

# 创建虚拟环境
python3.11 -m venv venv
source venv/bin/activate

# 安装依赖
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn

# 创建.env文件
cat > .env << EOF
DATABASE_URL=postgresql://ai_script_user:$DB_PASSWORD@localhost:5432/ai_script_studio
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=$OPENAI_KEY
ANTHROPIC_API_KEY=
MAX_CONCURRENT_REQUESTS=5
API_RETRY_MAX_ATTEMPTS=3
API_RETRY_BASE_DELAY=3
TASK_TIMEOUT=300
DEBUG=False
EOF

# 初始化数据库
python init_db.py

# 创建Gunicorn配置
cat > gunicorn_config.py << 'EOF'
bind = "127.0.0.1:8000"
workers = 4
worker_class = "uvicorn.workers.UvicornWorker"
timeout = 120
keepalive = 5
errorlog = "/var/log/ai-script-studio/gunicorn-error.log"
accesslog = "/var/log/ai-script-studio/gunicorn-access.log"
loglevel = "info"
EOF

# 创建日志目录
mkdir -p /var/log/ai-script-studio

# 10. 配置前端
echo -e "${YELLOW}[10/12] 配置前端...${NC}"
cd /var/www/ai-script-studio/frontend

# 创建生产环境配置
echo "REACT_APP_API_URL=http://$DOMAIN/api" > .env.production

# 安装依赖并构建
npm install
npm run build

# 11. 配置Systemd服务
echo -e "${YELLOW}[11/12] 配置系统服务...${NC}"
cat > /etc/systemd/system/ai-script-studio-backend.service << 'EOF'
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
EOF

# 12. 配置Nginx
echo -e "${YELLOW}[12/12] 配置Nginx...${NC}"
cat > /etc/nginx/sites-available/ai-script-studio << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        root /var/www/ai-script-studio/frontend/build;
        try_files \$uri \$uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    location /docs {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    access_log /var/log/nginx/ai-script-studio-access.log;
    error_log /var/log/nginx/ai-script-studio-error.log;
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/ai-script-studio /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试Nginx配置
nginx -t

# 设置权限
chown -R www-data:www-data /var/www/ai-script-studio
chown -R www-data:www-data /var/log/ai-script-studio

# 启动所有服务
systemctl daemon-reload
systemctl start ai-script-studio-backend
systemctl enable ai-script-studio-backend
systemctl restart nginx
systemctl enable nginx

# 配置防火墙
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
fi

echo ""
echo -e "${GREEN}=================================="
echo "部署完成！"
echo "==================================${NC}"
echo ""
echo "访问地址: http://$DOMAIN"
echo "API文档: http://$DOMAIN/docs"
echo ""
echo "查看后端状态: sudo systemctl status ai-script-studio-backend"
echo "查看后端日志: sudo journalctl -u ai-script-studio-backend -f"
echo "查看Nginx日志: sudo tail -f /var/log/nginx/ai-script-studio-error.log"
echo ""
echo -e "${YELLOW}建议：${NC}"
echo "1. 配置HTTPS: sudo certbot --nginx -d $DOMAIN"
echo "2. 设置数据库备份定时任务"
echo "3. 配置监控和告警"
echo ""
