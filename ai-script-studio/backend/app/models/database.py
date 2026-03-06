from sqlalchemy import Column, Integer, String, Text, JSON, Float, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum

Base = declarative_base()


class AgentPromptTemplate(Base):
    """Agent提示词与配置表"""
    __tablename__ = "agent_prompt_templates"

    agent_id = Column(Integer, primary_key=True, index=True)
    agent_name = Column(String(100), nullable=False)
    default_model = Column(String(50), default="gpt-4")
    temperature = Column(Float, default=0.7)
    system_instruction = Column(Text, nullable=False)  # 支持{{}}占位符
    output_schema = Column(JSON)  # JSON Schema定义
    version = Column(String(20), default="1.0")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IPProject(Base):
    """项目主表"""
    __tablename__ = "ip_projects"

    project_id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String(200), nullable=False)
    genre = Column(String(50))  # 题材类型
    core_premise = Column(Text)  # 核心创意
    global_lore_bible = Column(JSON)  # 全局常驻上下文（设定词典）
    status = Column(String(50), default="draft")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关系
    tasks = relationship("PipelineTask", back_populates="project")


class PipelineStageEnum(str, enum.Enum):
    """流水线阶段枚举"""
    CONCEPT_INPUT = "concept_input"
    OUTLINE_GENERATION = "outline_generation"
    OUTLINE_REVIEW = "outline_review"
    SETTING_EXTRACTION = "setting_extraction"
    SETTING_REVIEW = "setting_review"
    SCENE_BREAKDOWN = "scene_breakdown"
    SCENE_REVIEW = "scene_review"
    STORYBOARD_GENERATION = "storyboard_generation"
    QUALITY_CHECK = "quality_check"
    COMPLETED = "completed"


class EpisodeStatusEnum(str, enum.Enum):
    """分集任务状态枚举"""
    QUEUED = "queued"
    GENERATING = "generating"
    VALIDATING = "validating"
    RETRYING = "retrying"
    COMPLETED = "completed"
    FAILED = "failed"


class PipelineTask(Base):
    """流水线主任务记录"""
    __tablename__ = "pipeline_tasks"

    task_id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("ip_projects.project_id"), nullable=False)
    current_stage = Column(Enum(PipelineStageEnum), default=PipelineStageEnum.CONCEPT_INPUT)
    outline_data = Column(JSON)  # Agent 1输出
    settings_data = Column(JSON)  # Agent 2输出（设定词典）
    scenes_data = Column(JSON)  # Agent 3输出（细纲数组）
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关系
    project = relationship("IPProject", back_populates="tasks")
    episodes = relationship("TaskEpisodeTracking", back_populates="task")
    storyboards = relationship("StoryboardSegment", back_populates="task")


class TaskEpisodeTracking(Base):
    """分集并发追踪表"""
    __tablename__ = "task_episodes_tracking"

    tracking_id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("pipeline_tasks.task_id"), nullable=False)
    episode_index = Column(Integer, nullable=False)  # 集数编号
    status = Column(Enum(EpisodeStatusEnum), default=EpisodeStatusEnum.QUEUED)
    retry_count = Column(Integer, default=0)
    error_log = Column(Text)
    storyboard_data = Column(JSON)  # Agent 4输出的分镜数据
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关系
    task = relationship("PipelineTask", back_populates="episodes")


class StoryboardSegment(Base):
    """最终切片产出表"""
    __tablename__ = "storyboard_segments"

    segment_id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("pipeline_tasks.task_id"), nullable=False)
    episode_index = Column(Integer, nullable=False)
    shot_index = Column(Integer, nullable=False)  # 镜号
    visual_prompt = Column(Text, nullable=False)  # 画面描述
    dialogue = Column(Text)  # 台词
    duration = Column(Integer, nullable=False)  # 时长（秒），强制10-15秒
    approval_status = Column(String(50), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    # 关系
    task = relationship("PipelineTask", back_populates="storyboards")
