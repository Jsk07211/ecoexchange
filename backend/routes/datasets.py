from typing import Optional

from fastapi import APIRouter, HTTPException

from backend.models import Dataset
from backend.data.datasets import datasets

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.get("", response_model=list[Dataset])
def list_datasets(
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_dir: Optional[str] = "desc",
):
    result = list(datasets)
    if category:
        result = [d for d in result if d["category"] == category]
    if search:
        q = search.lower()
        result = [
            d
            for d in result
            if q in d["title"].lower()
            or q in d["organization"].lower()
            or q in d["description"].lower()
        ]
    if sort_by and sort_by in ("last_updated", "quality_score", "downloads", "records"):
        reverse = sort_dir != "asc"
        result.sort(key=lambda d: d[sort_by], reverse=reverse)
    return result


@router.get("/{dataset_id}", response_model=Dataset)
def get_dataset(dataset_id: str):
    for d in datasets:
        if d["id"] == dataset_id:
            return d
    raise HTTPException(status_code=404, detail="Dataset not found")
