from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.database import IPProject
from pydantic import BaseModel

router = APIRouter()


class ProjectCreate(BaseModel):
    project_name: str
    genre: str
    core_premise: str


class ProjectResponse(BaseModel):
    project_id: int
    project_name: str
    genre: str
    core_premise: str
    status: str

    class Config:
        from_attributes = True


@router.post("/", response_model=ProjectResponse)
async def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    """创建新项目"""
    db_project = IPProject(
        project_name=project.project_name,
        genre=project.genre,
        core_premise=project.core_premise
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(db: Session = Depends(get_db)):
    """获取项目列表"""
    projects = db.query(IPProject).all()
    return projects


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: int, db: Session = Depends(get_db)):
    """获取项目详情"""
    project = db.query(IPProject).filter(IPProject.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
