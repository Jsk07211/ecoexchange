from pydantic import BaseModel


class FormFieldConfig(BaseModel):
    field_name: str
    label: str
    field_type: str = "STRING"
    visible: bool = True
    required: bool = False
    order: int = 0


class FormConfigRequest(BaseModel):
    project_name: str
    table_name: str
    fields: list[FormFieldConfig]


class FormConfigResponse(BaseModel):
    id: str
    project_name: str
    table_name: str
    fields: list[FormFieldConfig]
    created_at: str
