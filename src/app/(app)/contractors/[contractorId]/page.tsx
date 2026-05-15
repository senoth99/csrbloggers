"use client";

import { useParams } from "next/navigation";
import { ContractorDetailScreen } from "@/screens/ContractorDetailScreen";

export default function ContractorDetailPage() {
  const params = useParams();
  const contractorId =
    typeof params.contractorId === "string" ? params.contractorId : "";
  return <ContractorDetailScreen contractorId={contractorId} variant="page" />;
}
