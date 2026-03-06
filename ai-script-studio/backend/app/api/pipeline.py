from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.database import PipelineTask, IPProject, PipelineStageEnum
from app.agents.agent_outline import OutlineAgent
from app.agents.agent_settings import SettingsAgent
from app.agents.agent_storyboard import StoryboardAgent
from pydantic import BaseModel
from typing import Dict, Any
import asyncio

router = APIRouter()


class OutlineGenerateRequest(BaseModel):
    project_id: int


class OutlineResponse(BaseModel):
    task_id: int
    outline_data: Dict[str, Any]


@router.post("/generate-outline", response_model=OutlineResponse)
async def generate_outline(request: OutlineGenerateRequest, db: Session = Depends(get_db)):
    """
    Step 1: 生成大纲
    """
    # 获取项目
    project = db.query(IPProject).filter(IPProject.project_id == request.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 创建任务
    task = PipelineTask(
        project_id=project.project_id,
        current_stage=PipelineStageEnum.OUTLINE_GENERATION
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # 执行Agent 1
    agent = OutlineAgent(model="gpt-4", temperature=0.7)
    context = {
        "core_premise": project.core_premise,
        "genre": project.genre,
        "reference_works": ""
    }

    try:
        outline_data = await agent.execute(context)

        # 保存结果
        task.outline_data = outline_data
        task.current_stage = PipelineStageEnum.OUTLINE_REVIEW
        db.commit()

        return {
            "task_id": task.task_id,
            "outline_data": outline_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate outline: {str(e)}")


@router.post("/extract-settings")
async def extract_settings(task_id: int, db: Session = Depends(get_db)):
    """
    Step 2: 提取设定词典
    """
    task = db.query(PipelineTask).filter(PipelineTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not task.outline_data:
        raise HTTPException(status_code=400, detail="Outline not generated yet")

    # 执行Agent 2
    agent = SettingsAgent(model="gpt-4", temperature=0.5)
    context = {
        "outline_data": task.outline_data
    }

    try:
        settings_data = await agent.execute(context)

        # 保存结果
        task.settings_data = settings_data
        task.current_stage = PipelineStageEnum.SETTING_REVIEW

        # 同时更新项目的全局设定
        project = task.project
        project.global_lore_bible = settings_data

        db.commit()

        return {
            "task_id": task.task_id,
            "settings_data": settings_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract settings: {str(e)}")
