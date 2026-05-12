"use client";

import {
  CONTRACTOR_RATING_TOOLTIP_RU,
  formatContractorRating10Display,
} from "@/lib/contractor-rating";

export function ContractorRatingBadge({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const text = formatContractorRating10Display(value);
  return (
    <span
      title={CONTRACTOR_RATING_TOOLTIP_RU}
      className={`tabular-nums font-semibold text-app-fg ${className}`}
      aria-label={`Рейтинг ${text} из 10`}
    >
      {text}
    </span>
  );
}
