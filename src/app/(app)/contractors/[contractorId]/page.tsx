import { ContractorDetailScreen } from "@/screens/ContractorDetailScreen";

export default function ContractorDetailPage({
  params,
}: {
  params: { contractorId: string };
}) {
  return <ContractorDetailScreen contractorId={params.contractorId} />;
}
