#!/bin/bash

# 快速更新脚本 - 用于更新已部署的应用

set -e

echo "=================================="
echo "AI Script Studio 快速更新"
echo "=================================="

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd /var/www/ai-script-studio

# 1. 拉取最新代码
echo -e "${YELLOW}[1/4] 拉取最新代码...${NC}"
git pull origin main

# 2. 更新后端
echo -e "${YELLOW}[2/4] 更新后端...${NC}"
cd backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart ai-script-studio-backend

# 3. 更新前端
echo -e "${YELLOW}[3/4] 更新前端...${NC}"
cd ../frontend
npm install
npm run build

# 4. 重启服务
echo -e "${YELLOW}[4/4] 重启服务...${NC}"
sudo systemctl restart nginx

echo ""
echo -e "${GREEN}更新完成！${NC}"
echo "查看状态: sudo systemctl status ai-script-studio-backend"
