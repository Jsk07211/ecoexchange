import { apiFetch } from "./client"
import type { Submission, SubmissionResponse } from "../types"

export async function submitObservation(data: Submission): Promise<SubmissionResponse> {
  const body = {
    selected_program: data.selectedProgram,
    observation_type: data.observationType,
    species_name: data.speciesName,
    count: data.count,
    notes: data.notes,
    latitude: data.latitude,
    longitude: data.longitude,
    date: data.date,
    time: data.time,
    habitat: data.habitat,
    confidence: data.confidence,
  }
  const res = await apiFetch<Record<string, unknown>>("/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return {
    selectedProgram: res.selected_program as string,
    observationType: res.observation_type as string | undefined,
    speciesName: res.species_name as string,
    count: res.count as string,
    notes: res.notes as string | undefined,
    latitude: res.latitude as string,
    longitude: res.longitude as string,
    date: res.date as string,
    time: res.time as string,
    habitat: res.habitat as string | undefined,
    confidence: res.confidence as string | undefined,
    id: res.id as string,
    submittedAt: res.submitted_at as string,
  }
}
