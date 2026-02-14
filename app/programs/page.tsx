import { ProgramCatalog } from "@/components/programs/program-catalog"

export const metadata = {
  title: "Programs - EcoExchange",
  description:
    "Browse and discover active citizen-science programs for sustainability data collection.",
}

export default function ProgramsPage() {
  return <ProgramCatalog />
}
