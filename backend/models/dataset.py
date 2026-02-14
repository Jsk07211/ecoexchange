from pydantic import BaseModel


class Dataset(BaseModel):
    id: str
    title: str
    program: str
    organization: str
    category: str
    records: int
    format: str
    license: str
    last_updated: str
    quality_score: int
    downloads: int
    description: str
    tags: list[str]
