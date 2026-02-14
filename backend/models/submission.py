from typing import Optional
from pydantic import BaseModel


class Submission(BaseModel):
    selected_program: str
    observation_type: Optional[str] = None
    species_name: str
    count: str
    notes: Optional[str] = None
    latitude: str
    longitude: str
    date: str
    time: str
    habitat: Optional[str] = None
    confidence: Optional[str] = None


class SubmissionResponse(Submission):
    id: str
    submitted_at: str
