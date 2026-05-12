"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { usePanelData } from "@/context/PanelDataContext";
import { ContractorRatingBadge } from "@/components/ContractorRatingBadge";
import { computeContractorRating10 } from "@/lib/contractor-rating";
import type { Contractor } from "@/types/panel-data";
import { listDivideClass } from "@/screens/dashboard-shared";

const searchField =
  "w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2";

type Props = {
  open: boolean;
  onClose: () => void;
  contractors: Contractor[];
  onPick: (contractorId: string) => void;
  zIndexClass?: string;
  title?: string;
};

export function ContractorListModal({
  open,
  onClose,
  contractors,
  onPick,
  zIndexClass = "z-[60]",
  title = "Выбор контрагента",
}: Props) {
  const { integrations, contractorItems } = usePanelData();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contractors;
    return contractors.filter((c) => {
      const fio = (c.contactPerson ?? "").toLowerCase();
      const nick = (c.name ?? "").toLowerCase();
      return fio.includes(q) || nick.includes(q);
    });
  }, [contractors, query]);

  const ratingById = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of filtered) {
      const ints = integrations.filter((i) => i.contractorId === c.id);
      const nItems = contractorItems.filter((it) => it.contractorId === c.id).length;
      m.set(c.id, computeContractorRating10(ints, nItems));
    }
    return m;
  }, [filtered, integrations, contractorItems]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/75 px-4`}
    >
      <div className="w-full max-w-2xl border border-app-fg/15 bg-app-bg p-5 shadow-accent-glow sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-app-fg">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="border border-app-fg/15 p-1.5 text-app-fg/70 transition hover:border-app-fg/40"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по ФИО или нику..."
          className={`${searchField} mb-4`}
        />

        <div className="max-h-[60vh] overflow-y-auto border border-app-fg/15">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-sm text-app-fg/55">Ничего не найдено.</p>
          ) : (
            <div className={listDivideClass}>
              {filtered.map((contractor) => (
                <button
                  key={contractor.id}
                  type="button"
                  onClick={() => {
                    onPick(contractor.id);
                    setQuery("");
                    onClose();
                  }}
                  className="block w-full px-4 py-3.5 text-left transition hover:bg-app-fg/[0.04]"
                >
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-wide text-app-fg">
                  <span>{contractor.name}</span>
                  <ContractorRatingBadge value={ratingById.get(contractor.id) ?? 5} />
                </p>
                <p className="mt-0.5 text-sm text-app-fg/65">
                  {contractor.contactPerson?.trim() || "Без ФИО"}
                </p>
              </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
