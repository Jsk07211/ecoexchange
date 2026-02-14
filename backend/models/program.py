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
