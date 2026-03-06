# 🌋 火山云服务器配置指南

## 一、购买和配置火山云服务器

### 1. 登录火山引擎控制台
访问：https://console.volcengine.com/

### 2. 创建云服务器（ECS）

**推荐配置：**
- **实例规格**: ecs.g3i.large（2核4GB）或更高
- **操作系统**: Ubuntu 20.04 LTS 64位
- **系统盘**: 40GB SSD
- **带宽**: 5Mbps或更高
- **地域**: 选择离你用户最近的区域

### 3. 配置安全组

在火山云控制台 → 云服务器 → 安全组，添加以下规则：

| 协议 | 端口范围 | 授权对象 | 说明 |
|------|---------|---------|------|
| TCP | 22 | 0.0.0.0/0 | SSH登录 |
| TCP | 80 | 0.0.0.0/0 | HTTP访问 |
| TCP | 443 | 0.0.0.0/0 | HTTPS访问 |

**安全建议**：
- SSH端口22建议改为其他端口
- 或限制SSH访问IP为你的办公网IP

### 4. 绑定弹性公网IP

确保服务器有公网IP，用于外部访问。

---

## 二、连接到服务器

### 方法1：使用火山云Web终端（最简单）

1. 登录火山云控制台
2. 找到你的云服务器实例
3. 点击"远程连接" → "VNC登录"
4. 输入root密码

### 方法2：使用SSH客户端

**Windows用户（使用Git Bash或PowerShell）：**
```bash
ssh root@your-server-ip
```

**首次连接需要输入密码**（购买时设置的密码）

---

## 三、快速部署步骤

### Step 1: 上传部署脚本

**方法A：直接在服务器上下载**
```bash
# 连接到服务器后
cd /tmp
wget https://raw.githubusercontent.com/your-repo/ai-script-studio/main/deploy.sh
chmod +x deploy.sh
```

**方法B：从本地上传**
```bash
# 在本地Windows上
scp deploy.sh root@your-server-ip:/tmp/
```

### Step 2: 运行部署脚本

```bash
ssh root@your-server-ip
cd /tmp
sudo bash deploy.sh
```

按提示输入：
1. **数据库密码**：设置一个强密码（至少16位，包含大小写字母、数字、特殊字符）
2. **OpenAI API Key**：你的OpenAI API密钥（sk-开头）
3. **域名或IP**：你的服务器公网IP或已绑定的域名
4. **Git仓库**：如果代码在Git上，输入仓库地址；否则留空

### Step 3: 等待部署完成

脚本会自动安装所有依赖并配置服务，大约需要10-15分钟。

### Step 4: 验证部署

```bash
# 检查服务状态
sudo systemctl status ai-script-studio-backend

# 测试API
curl http://localhost:8000/health
```

在浏览器访问：`http://your-server-ip`

---

## 四、火山云特定优化

### 1. 使用火山云对象存储（TOS）

如果需要存储大量生成的视频或图片：

```bash
# 安装TOS SDK
pip install tos
```

在代码中配置TOS：
```python
# backend/app/core/config.py
TOS_ACCESS_KEY = "your-access-key"
TOS_SECRET_KEY = "your-secret-key"
TOS_ENDPOINT = "tos-cn-beijing.volces.com"
TOS_BUCKET = "ai-script-studio"
```

### 2. 使用火山云RDS（托管数据库）

如果流量较大，建议使用RDS替代自建PostgreSQL：

1. 在火山云控制台创建RDS实例（PostgreSQL）
2. 获取连接地址
3. 修改 `.env` 文件：
```env
DATABASE_URL=postgresql://username:password@rds-endpoint:5432/ai_script_studio
```

### 3. 使用火山云Redis（托管缓存）

1. 在火山云控制台创建Redis实例
2. 获取连接地址
3. 修改 `.env` 文件：
```env
REDIS_URL=redis://:password@redis-endpoint:6379/0
```

### 4. 配置火山云CDN

加速前端静态资源访问：

1. 在火山云控制台开通CDN服务
2. 添加加速域名
3. 源站配置为你的服务器IP
4. 配置缓存规则：
   - `.js`, `.css`, `.png`, `.jpg` 等静态资源缓存7天
   - HTML文件缓存1小时

---

## 五、域名配置（可选）

### 1. 购买域名

可以在火山云或其他域名注册商购买域名。

### 2. 配置DNS解析

在火山云控制台 → 域名服务 → DNS解析：

| 记录类型 | 主机记录 | 记录值 | TTL |
|---------|---------|--------|-----|
| A | @ | 你的服务器IP | 600 |
| A | www | 你的服务器IP | 600 |

### 3. 配置HTTPS

```bash
# 安装Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 测试自动续期
sudo certbot renew --dry-run
```

---

## 六、监控和告警

### 1. 使用火山云监控服务

在火山云控制台配置：
- CPU使用率告警（>80%）
- 内存使用率告警（>80%）
- 磁盘使用率告警（>80%）
- 网络流量监控

### 2. 配置日志服务（TLS）

```bash
# 安装日志采集器
wget https://lts-agent.volcengine.com/install.sh
sudo bash install.sh
```

配置日志采集：
- 应用日志：`/var/log/ai-script-studio/`
- Nginx日志：`/var/log/nginx/`
- 系统日志：`/var/log/syslog`

---

## 七、成本优化建议

### 1. 使用按量付费

开发测试阶段使用按量付费，正式运营后购买包年包月。

### 2. 合理配置实例规格

- **开发环境**: 1核2GB（约50元/月）
- **小规模生产**: 2核4GB（约150元/月）
- **中等规模**: 4核8GB（约300元/月）

### 3. 使用预留实例

长期使用可购买预留实例，节省30-50%成本。

### 4. 配置自动伸缩

流量波动大时，配置自动伸缩组：
- 低峰期：1台服务器
- 高峰期：自动扩展到3-5台

---

## 八、备份策略

### 1. 数据库备份

```bash
# 手动备份
sudo bash /var/www/ai-script-studio/backup.sh

# 自动备份（每天凌晨2点）
sudo crontab -e
# 添加：
0 2 * * * /var/www/ai-script-studio/backup.sh
```

### 2. 使用火山云快照

在火山云控制台：
- 创建系统盘快照（每周一次）
- 设置自动快照策略
- 保留最近7天的快照

### 3. 异地备份

将重要数据备份到火山云对象存储（TOS）：
```bash
# 安装TOS CLI
pip install tos-cli

# 上传备份
tos-cli cp /var/backups/ai-script-studio/ tos://your-bucket/backups/ --recursive
```

---

## 九、故障恢复

### 场景1：服务器宕机

1. 在火山云控制台重启实例
2. 检查服务状态：
```bash
sudo systemctl status ai-script-studio-backend
```

### 场景2：数据库损坏

```bash
# 停止服务
sudo systemctl stop ai-script-studio-backend

# 恢复备份
gunzip /var/backups/ai-script-studio/db_backup_latest.sql.gz
psql -U ai_script_user -d ai_script_studio < /var/backups/ai-script-studio/db_backup_latest.sql

# 重启服务
sudo systemctl start ai-script-studio-backend
```

### 场景3：代码回滚

```bash
cd /var/www/ai-script-studio
git log --oneline  # 查看提交历史
git reset --hard commit-hash  # 回滚到指定版本
sudo bash update.sh  # 重新部署
```

---

## 十、技术支持

### 火山云技术支持
- 工单系统：控制台 → 工单中心
- 技术文档：https://www.volcengine.com/docs/
- 客服电话：400-xxx-xxxx

### 应用技术支持
- 查看部署文档：`DEPLOY.md`
- 查看快速指南：`DEPLOY_QUICK.md`
- 检查日志文件

---

## 快速命令参考

```bash
# 查看服务器信息
curl http://100.100.100.200/latest/meta-data/instance-id  # 实例ID
curl http://100.100.100.200/latest/meta-data/public-ipv4  # 公网IP

# 查看系统资源
htop
df -h
free -h

# 查看服务状态
sudo systemctl status ai-script-studio-backend nginx postgresql redis-server

# 查看日志
sudo journalctl -u ai-script-studio-backend -f

# 重启服务
sudo systemctl restart ai-script-studio-backend
```

---

## 部署检查清单

- [ ] 服务器已创建并配置安全组
- [ ] 已绑定弹性公网IP
- [ ] 已连接到服务器
- [ ] 已运行部署脚本
- [ ] 所有服务状态正常
- [ ] 可以通过浏览器访问
- [ ] API测试通过
- [ ] 已配置HTTPS（如有域名）
- [ ] 已设置数据库备份
- [ ] 已配置监控告警

完成以上步骤后，你的AI Script Studio就成功部署到火山云了！
