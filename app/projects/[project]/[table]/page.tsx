import { DynamicTableViewer } from "@/components/tables/dynamic-table-viewer"

interface Props {
  params: Promise<{ project: string; table: string }>
}

export function generateMetadata() {
  return {
    title: "Project Data - EcoExchange",
    description: "View data collected for a project.",
  }
}

export default async function ProjectTablePage({ params }: Props) {
  const { project, table } = await params

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
      <DynamicTableViewer project={project} table={table} />
    </div>
  )
}
