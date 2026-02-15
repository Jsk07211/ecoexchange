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
  tableCnn?: Record<string, string>
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
  tableCnn?: Record<string, string>
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

export type VisualizationChartType =
  | "table"
  | "line"
  | "bar"
  | "area"
  | "scatter"
  | "pie"
  | "histogram"
  | "violin"
  | "scatter_matrix"
  | "stat_card"
  | "map"
  | "note"
  | "grouped_bar"
  | "stacked_bar"
  | "stacked_area"
  | "heatmap"
  | "box_plot"
  | "bubble"
  | "radar"
  | "sunburst"

export type VisualizationAggregateMethod =
  | "raw"
  | "count"
  | "sum"
  | "mean"
  | "avg"
  | "min"
  | "max"
  | "median"
  | "mode"
  | "distinct"

export interface VisualizationMetric {
  field: string
  aggregate: VisualizationAggregateMethod
  color?: string
  legendLabel?: string
}

export type TileFilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "not_contains"
  | "in"
  | "not_in"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "between"
  | "before"
  | "after"
  | "date_between"

export interface VisualizationTileFilter {
  id: string
  field: string
  operator: TileFilterOperator
  value?: string
  values?: string[]
  min?: string
  max?: string
}

export interface VisualizationWidget {
  id: string
  title: string
  table: string
  chartType: VisualizationChartType
  valueMode?: "raw" | "measures"
  xField?: string
  yField?: string
  metrics: VisualizationMetric[]
  groupField?: string
  matrixFields?: string[]
  latField?: string
  lngField?: string
  noteContent?: string
  sizeField?: string // For bubble charts
  categoryField?: string // For sunburst, radar
  stackMode?: "grouped" | "stacked" // For grouped/stacked bar/area
  xAxisLabel?: string
  yAxisLabel?: string
  showLegend?: boolean
  colorByCategory?: boolean
  categoryColors?: Record<string, string>
  filters?: VisualizationTileFilter[]
  tileWidth?: 1 | 2 | 3
  tileHeight?: "sm" | "md" | "lg"
  layoutX?: number
  layoutY?: number
  layoutW?: number
  layoutH?: number
}

export interface VisualizationGlobalFilter {
  id: string
  table: string
  field: string
  operator: "between" | "eq" | "contains" | "gte" | "lte"
  value?: string
  startDate?: string
  endDate?: string
  startValue?: string
  endValue?: string
}

export interface VisualizationConfig {
  widgets: VisualizationWidget[]
  globalFilters?: VisualizationGlobalFilter[]
}

export interface Visualization {
  id: string
  programId: string
  name: string
  description?: string
  config: VisualizationConfig
  createdAt: string
}
