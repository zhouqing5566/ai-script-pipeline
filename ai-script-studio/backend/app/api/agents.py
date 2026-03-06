from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.database import AgentPromptTemplate
from pydantic import BaseModel

router = APIRouter()


class AgentPromptResponse(BaseModel):
    agent_id: int
    agent_name: str
    default_model: str
    temperature: float
    system_instruction: str
    version: str
    is_active: bool

    class Config:
        from_attributes = True


@router.get("/", response_model=List[AgentPromptResponse])
async def list_agents(db: Session = Depends(get_db)):
    """获取所有Agent配置"""
    agents = db.query(AgentPromptTemplate).filter(AgentPromptTemplate.is_active == True).all()
    return agents


@router.get("/{agent_id}", response_model=AgentPromptResponse)
async def get_agent(agent_id: int, db: Session = Depends(get_db)):
    """获取单个Agent配置"""
    agent = db.query(AgentPromptTemplate).filter(AgentPromptTemplate.agent_id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent
