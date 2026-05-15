"use client";

import { useParams } from "next/navigation";
import { DeliveryDetailScreen } from "@/screens/DeliveryDetailScreen";

export default function DeliveryDetailPage() {
  const params = useParams();
  const deliveryId = typeof params.deliveryId === "string" ? params.deliveryId : "";
  return <DeliveryDetailScreen deliveryId={deliveryId} variant="page" />;
}
