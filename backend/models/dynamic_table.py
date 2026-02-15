from enum import Enum

from pydantic import BaseModel, ConfigDict


class FieldType(str, Enum):
    INT = "INT"
    STRING = "STRING"
    FLOAT = "FLOAT"
    BOOLEAN = "BOOLEAN"
    DATE = "DATE"
    TEXT = "TEXT"

    @property
    def sql_type(self) -> str:
        mapping = {
            FieldType.INT: "INTEGER",
            FieldType.STRING: "VARCHAR(255)",
            FieldType.FLOAT: "DOUBLE PRECISION",
            FieldType.BOOLEAN: "BOOLEAN",
            FieldType.DATE: "DATE",
            FieldType.TEXT: "TEXT",
        }
        return mapping[self]


class FieldDefinition(BaseModel):
    name: str
    type: FieldType


class DynamicTableRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "project_name": "wildlife_tracking",
                    "table_name": "sightings",
                    "fields": [
                        {"name": "species", "type": "STRING"},
                        {"name": "latitude", "type": "FLOAT"},
                        {"name": "longitude", "type": "FLOAT"},
                        {"name": "observed_on", "type": "DATE"},
                        {"name": "count", "type": "INT"},
                    ],
                }
            ]
        }
    )

    project_name: str
    table_name: str
    fields: list[FieldDefinition]
