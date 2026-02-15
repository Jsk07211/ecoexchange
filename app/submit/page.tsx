import { SubmissionForm } from "@/components/submit/submission-form"

export const metadata = {
  title: "Submit Data - EcoExchange",
  description:
    "Submit citizen-science observations with guided forms and real-time quality validation.",
}

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string }>
}) {
  const params = await searchParams
  return <SubmissionForm programId={params.program} />
}
