import { apiFetch } from "./client"
import type { FormConfigRequest, FormConfigResponse, FieldType } from "../types"

export async function saveFormConfig(data: FormConfigRequest): Promise<FormConfigResponse> {
  const body = {
    project_name: data.projectName,
    table_name: data.tableName,
    fields: data.fields.map((f) => ({
      field_name: f.fieldName,
      label: f.label,
      field_type: f.fieldType,
      visible: f.visible,
      required: f.required,
      order: f.order,
    })),
  }
  const res = await apiFetch<Record<string, unknown>>("/api/form-configs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return mapFormConfigResponse(res)
}

export async function getFormConfig(
  projectName: string,
  tableName: string
): Promise<FormConfigResponse> {
  const res = await apiFetch<Record<string, unknown>>(
    `/api/form-configs/${projectName}/${tableName}`
  )
  return mapFormConfigResponse(res)
}

function mapFormConfigResponse(res: Record<string, unknown>): FormConfigResponse {
  return {
    id: res.id as string,
    projectName: res.project_name as string,
    tableName: res.table_name as string,
    fields: (res.fields as Array<Record<string, unknown>>).map((f) => ({
      fieldName: f.field_name as string,
      label: f.label as string,
      fieldType: (f.field_type as FieldType) || "STRING",
      visible: f.visible as boolean,
      required: f.required as boolean,
      order: f.order as number,
    })),
    createdAt: res.created_at as string,
  }
}
