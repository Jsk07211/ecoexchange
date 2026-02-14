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
