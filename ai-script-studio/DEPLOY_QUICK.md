# 🚀 火山云部署快速指南

## 方式一：自动部署（推荐）

### 1. 上传代码到服务器

**选项A：使用Git（推荐）**
```bash
# 在本地，先将代码推送到Git仓库
cd /c/Users/NINGMEI/Desktop/ai-script-studio
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/ai-script-studio.git
git push -u origin main
```

**选项B：使用SCP直接上传**
```bash
# 在本地Windows上，使用Git Bash或PowerShell
scp -r ai-script-studio root@your-server-ip:/tmp/
```

### 2. 在服务器上运行自动部署脚本

```bash
# SSH连接到火山云服务器
ssh root@your-server-ip

# 如果使用Git
cd /tmp
git clone https://github.com/your-username/ai-script-studio.git
cd ai-script-studio

# 如果使用SCP
cd /tmp/ai-script-studio

# 运行自动部署脚本
chmod +x deploy.sh
sudo bash deploy.sh
```

脚本会提示你输入：
- 数据库密码（自己设置一个强密码）
- OpenAI API Key
- 域名或IP地址
- Git仓库地址（可选）

### 3. 等待部署完成

脚本会自动完成所有配置，大约需要10-15分钟。

---

## 方式二：手动部署

如果自动脚本失败，请参考 `DEPLOY.md` 文档进行手动部署。

---

## 部署后检查清单

### ✅ 服务状态检查

```bash
# 1. 检查后端服务
sudo systemctl status ai-script-studio-backend

# 2. 检查Nginx
sudo systemctl status nginx

# 3. 检查PostgreSQL
sudo systemctl status postgresql

# 4. 检查Redis
sudo systemctl status redis-server

# 5. 测试API
curl http://localhost:8000/health
```

### ✅ 访问测试

在浏览器中访问：
- 前端: `http://your-server-ip`
- API文档: `http://your-server-ip/docs`
- 健康检查: `http://your-server-ip/api/health`

### ✅ 日志检查

```bash
# 后端日志
sudo journalctl -u ai-script-studio-backend -n 50

# Nginx日志
sudo tail -f /var/log/nginx/ai-script-studio-error.log

# Gunicorn日志
sudo tail -f /var/log/ai-script-studio/gunicorn-error.log
```

---

## 常见问题解决

### 问题1：后端服务无法启动

```bash
# 查看详细错误
sudo journalctl -u ai-script-studio-backend -n 100

# 检查权限
sudo chown -R www-data:www-data /var/www/ai-script-studio

# 手动测试
cd /var/www/ai-script-studio/backend
source venv/bin/activate
python -c "from app.main import app; print('Import OK')"
```

### 问题2：数据库连接失败

```bash
# 测试数据库连接
psql -U ai_script_user -d ai_script_studio -h localhost

# 如果提示密码错误，重置密码
sudo -u postgres psql
ALTER USER ai_script_user WITH PASSWORD 'new_password';
\q

# 更新.env文件中的密码
sudo vim /var/www/ai-script-studio/backend/.env
```

### 问题3：前端显示空白

```bash
# 检查前端构建
cd /var/www/ai-script-studio/frontend
ls -la build/

# 重新构建
npm run build

# 检查Nginx配置
sudo nginx -t
sudo systemctl restart nginx
```

### 问题4：API调用失败

```bash
# 检查API密钥
cat /var/www/ai-script-studio/backend/.env | grep API_KEY

# 测试OpenAI连接
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## 配置HTTPS（强烈推荐）

```bash
# 安装Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取SSL证书（需要域名）
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo systemctl enable certbot.timer
```

---

## 日常维护命令

### 查看服务状态
```bash
sudo systemctl status ai-script-studio-backend
```

### 重启服务
```bash
sudo systemctl restart ai-script-studio-backend
sudo systemctl restart nginx
```

### 更新代码
```bash
cd /var/www/ai-script-studio
chmod +x update.sh
sudo bash update.sh
```

### 备份数据
```bash
chmod +x backup.sh
sudo bash backup.sh

# 设置定时备份（每天凌晨2点）
sudo crontab -e
# 添加：0 2 * * * /var/www/ai-script-studio/backup.sh
```

### 查看日志
```bash
# 实时查看后端日志
sudo journalctl -u ai-script-studio-backend -f

# 查看最近的错误
sudo journalctl -u ai-script-studio-backend -p err -n 50
```

---

## 性能监控

### 安装监控工具
```bash
# 安装htop
sudo apt install -y htop

# 查看系统资源
htop

# 查看磁盘使用
df -h

# 查看内存使用
free -h
```

### 数据库性能
```bash
# 连接数据库
sudo -u postgres psql ai_script_studio

# 查看活动连接
SELECT * FROM pg_stat_activity;

# 查看表大小
SELECT pg_size_pretty(pg_total_relation_size('pipeline_tasks'));
```

---

## 安全加固

### 1. 修改SSH端口
```bash
sudo vim /etc/ssh/sshd_config
# 修改 Port 22 为其他端口
sudo systemctl restart sshd
```

### 2. 安装fail2ban
```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
```

### 3. 配置防火墙
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 4. 定期更新
```bash
sudo apt update && sudo apt upgrade -y
```

---

## 扩展配置

### 增加并发处理能力

编辑 `/var/www/ai-script-studio/backend/gunicorn_config.py`:
```python
workers = 8  # 增加worker数量
```

编辑 `/var/www/ai-script-studio/backend/.env`:
```env
MAX_CONCURRENT_REQUESTS=10  # 增加并发限制
```

重启服务：
```bash
sudo systemctl restart ai-script-studio-backend
```

---

## 联系支持

如果遇到无法解决的问题：
1. 收集错误日志
2. 记录复现步骤
3. 检查 DEPLOY.md 详细文档
4. 查看 GitHub Issues

---

## 快速命令参考

```bash
# 一键重启所有服务
sudo systemctl restart ai-script-studio-backend nginx postgresql redis-server

# 一键查看所有日志
sudo journalctl -u ai-script-studio-backend -n 20 && \
sudo tail -20 /var/log/nginx/ai-script-studio-error.log

# 一键检查所有服务状态
sudo systemctl status ai-script-studio-backend nginx postgresql redis-server
```
