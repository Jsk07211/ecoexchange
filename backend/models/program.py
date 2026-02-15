from typing import Literal, Optional
from pydantic import BaseModel


class Program(BaseModel):
    id: str
    title: str
    organization: str
    category: str
    description: str
    location: str
    participants: int
    data_points: int
    status: Literal["active", "upcoming", "completed"]
    tags: list[str]
    deadline: Optional[str] = None
    contribution_spec: Optional[dict] = None
    project_name: Optional[str] = None
    table_name: Optional[str] = None
    cnn_filter: Optional[str] = None


class ProgramCreate(BaseModel):
    title: str
    organization: str = ""
    category: str = "Biodiversity"
    description: str = ""
    location: str = ""
    tags: list[str] = []
    project_name: Optional[str] = None
    table_name: Optional[str] = None
    accepted_files: list[str] = []
    fields: list[dict] = []
    cnn_filter: Optional[str] = None
