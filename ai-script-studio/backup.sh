#!/bin/bash

# 数据库备份脚本

BACKUP_DIR="/var/backups/ai-script-studio"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="ai_script_studio"
DB_USER="ai_script_user"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
echo "开始备份数据库..."
PGPASSWORD=$DB_PASSWORD pg_dump -U $DB_USER $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# 压缩备份文件
gzip $BACKUP_DIR/db_backup_$DATE.sql

# 备份代码（可选）
echo "备份代码..."
tar -czf $BACKUP_DIR/code_backup_$DATE.tar.gz /var/www/ai-script-studio \
    --exclude='/var/www/ai-script-studio/backend/venv' \
    --exclude='/var/www/ai-script-studio/frontend/node_modules' \
    --exclude='/var/www/ai-script-studio/frontend/build'

# 保留最近7天的备份
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "code_backup_*.tar.gz" -mtime +7 -delete

echo "备份完成: $BACKUP_DIR"
ls -lh $BACKUP_DIR | tail -5
