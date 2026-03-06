"""
数据库初始化脚本
运行此脚本创建所有表
"""
from app.models.database import Base
from app.core.database import engine


def init_db():
    """创建所有表"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")


if __name__ == "__main__":
    init_db()
