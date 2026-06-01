"use client";

import { X } from "lucide-react";
import {
  buildCasherProductImageUrl,
  filterCasherProducts,
  type CasherProduct,
} from "@/lib/casher-products";

type CasherProductPickerModalProps = {
  open: boolean;
  onClose: () => void;
  products: CasherProduct[];
  search: string;
  onSearchChange: (value: string) => void;
  selectedProductId: string;
  onSelectProduct: (productId: string) => void;
  loading?: boolean;
  error?: string | null;
};

export function CasherProductPickerModal({
  open,
  onClose,
  products,
  search,
  onSearchChange,
  selectedProductId,
  onSelectProduct,
  loading = false,
  error = null,
}: CasherProductPickerModalProps) {
  if (!open) return null;

  const filtered = filterCasherProducts(products, search);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4">
      <div className="w-full max-w-4xl border border-app-fg/15 bg-app-bg p-5 shadow-accent-glow sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-app-fg">
            Выбор вещи
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
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск по названию..."
          className="mb-4 w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
        />

        {loading ? (
          <p className="border border-dashed border-app-fg/15 px-4 py-8 text-sm text-app-fg/55">
            Загрузка каталога…
          </p>
        ) : error ? (
          <p className="border border-dashed border-app-fg/15 px-4 py-8 text-sm text-app-fg/55">
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <p className="border border-dashed border-app-fg/15 px-4 py-8 text-sm text-app-fg/55">
            Ничего не найдено.
          </p>
        ) : (
          <div className="max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((p) => {
                const pid = String(p.id ?? "");
                const isSelected = pid === selectedProductId;
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => {
                      onSelectProduct(pid);
                      onClose();
                    }}
                    className={
                      isSelected
                        ? "overflow-hidden border-2 border-app-accent bg-app-bg text-left"
                        : "overflow-hidden border border-app-fg/15 bg-app-bg text-left transition hover:border-app-fg/40"
                    }
                  >
                    <div className="aspect-square w-full bg-app-fg/5">
                      {buildCasherProductImageUrl(p.images?.[0]) ? (
                        <img
                          src={buildCasherProductImageUrl(p.images?.[0])}
                          alt={p.name ?? pid}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-app-fg/40">
                          Нет фото
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="line-clamp-2 text-xs font-medium text-app-fg">
                        {p.name ?? `Товар ${pid}`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
