import { DatasetBrowser } from "@/components/datasets/dataset-browser"

export const metadata = {
  title: "Datasets - EcoExchange",
  description:
    "Browse and download quality-checked citizen-science datasets for sustainability research.",
}

export default function DatasetsPage() {
  return <DatasetBrowser />
}
