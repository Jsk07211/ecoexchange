from typing import Optional

from pydantic import BaseModel


class Visualization(BaseModel):
    id: str
    program_id: str
    name: str
    description: Optional[str] = None
    config: dict
    created_at: str


class VisualizationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    config: dict
