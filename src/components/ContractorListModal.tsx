"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { usePanelData } from "@/context/PanelDataContext";
import { ContractorRatingBadge } from "@/components/ContractorRatingBadge";
import { computeContractorRating10 } from "@/lib/contractor-rating";
import { useDialogA11y } from "@/lib/focus-trap";
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
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const { onKeyDownTrap } = useDialogA11y(open, onClose, panelRef);

  const filtered = useMemo(() => {
    const sorted = [...contractors].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((c) => {
      const fio = (c.contactPerson ?? "").toLowerCase();
      const nick = (c.name ?? "").toLowerCase();
      return fio.includes(q) || nick.includes(q);
    });
  }, [contractors, query]);

  const integrationsByContractor = useMemo(() => {
    const m = new Map<string, typeof integrations>();
    for (const i of integrations) {
      const list = m.get(i.contractorId);
      if (list) list.push(i);
      else m.set(i.contractorId, [i]);
    }
    return m;
  }, [integrations]);

  const itemCountByContractor = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of contractorItems) {
      m.set(it.contractorId, (m.get(it.contractorId) ?? 0) + 1);
    }
    return m;
  }, [contractorItems]);

  const ratingById = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of filtered) {
      const ints = integrationsByContractor.get(c.id) ?? [];
      const nItems = itemCountByContractor.get(c.id) ?? 0;
      m.set(c.id, computeContractorRating10(ints, nItems));
    }
    return m;
  }, [filtered, integrationsByContractor, itemCountByContractor]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/75 px-4 py-8`}
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(85dvh,100%)] w-full max-w-2xl flex-col border border-app-fg/15 bg-app-bg p-5 shadow-accent-glow sm:p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDownTrap}
      >
        <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
          <h3
            id={titleId}
            className="text-sm font-semibold uppercase tracking-[0.1em] text-app-fg"
          >
            {title}
          </h3>
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
          placeholder="Поиск по контактному лицу или нику..."
          className={`${searchField} mb-4 shrink-0`}
        />

        <div className="min-h-0 flex-1 overflow-y-auto border border-app-fg/15">
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
                    {contractor.contactPerson?.trim() || "Без контактного лица"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
