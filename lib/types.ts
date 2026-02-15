export interface ContributionField {
  name: string
  type: "INT" | "STRING" | "FLOAT" | "BOOLEAN" | "DATE" | "TEXT" | "IMAGE"
  required: boolean
  description?: string
}

export interface ContributionSpec {
  accepted_files: string[]
  fields: ContributionField[]
}

export interface Program {
  id: string
  title: string
  organization: string
  category: string
  description: string
  location: string
  participants: number
  dataPoints: number
  status: "active" | "upcoming" | "completed"
  tags: string[]
  deadline?: string
  contributionSpec?: ContributionSpec
  projectName?: string
  tableName?: string
  cnnFilter?: string
}

export type FieldType = "INT" | "STRING" | "FLOAT" | "BOOLEAN" | "DATE" | "TEXT" | "IMAGE"

export interface FieldDefinition {
  name: string
  type: FieldType
}

export interface DynamicTableRequest {
  projectName: string
  tableName: string
  fields: FieldDefinition[]
}

export interface DynamicTableResponse {
  status: string
  database: string
  table: string
  columns: string[]
}

export interface ProgramCreate {
  title: string
  organization?: string
  category?: string
  description?: string
  location?: string
  tags?: string[]
  projectName?: string
  tableName?: string
  acceptedFiles?: string[]
  fields?: FieldDefinition[]
  cnnFilter?: string
}

export interface FormFieldConfig {
  fieldName: string
  label: string
  fieldType: string
  visible: boolean
  required: boolean
  order: number
}

export interface FormConfigRequest {
  projectName: string
  tableName: string
  fields: FormFieldConfig[]
}

export interface FormConfigResponse {
  id: string
  projectName: string
  tableName: string
  fields: FormFieldConfig[]
  createdAt: string
}

export interface Dataset {
  id: string
  title: string
  program: string
  organization: string
  category: string
  records: number
  format: string
  license: string
  lastUpdated: string
  qualityScore: number
  downloads: number
  description: string
  tags: string[]
}

export interface Submission {
  selectedProgram: string
  observationType?: string
  speciesName: string
  count: string
  notes?: string
  latitude: string
  longitude: string
  date: string
  time: string
  habitat?: string
  confidence?: string
}

export interface SubmissionResponse extends Submission {
  id: string
  submittedAt: string
}
