from typing import Optional

from fastapi import APIRouter, HTTPException

from backend.models import Program
from backend.data.programs import programs

router = APIRouter(prefix="/api/programs", tags=["programs"])


@router.get("", response_model=list[Program])
def list_programs(
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    result = programs
    if category:
        result = [p for p in result if p["category"] == category]
    if status:
        result = [p for p in result if p["status"] == status.lower()]
    if search:
        q = search.lower()
        result = [
            p
            for p in result
            if q in p["title"].lower()
            or q in p["organization"].lower()
            or q in p["description"].lower()
        ]
    return result


@router.get("/{program_id}", response_model=Program)
def get_program(program_id: str):
    for p in programs:
        if p["id"] == program_id:
            return p
    raise HTTPException(status_code=404, detail="Program not found")
