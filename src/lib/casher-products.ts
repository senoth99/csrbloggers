export const CASHER_PRODUCTS_API_URL = "/api/casher-products";
export const CASHER_API_ORIGIN = "https://api.cashercollection.com";

export type CasherProductSize = {
  id?: number;
  size?: string;
  isVisible?: boolean;
};

export type CasherProduct = {
  id?: string | number;
  name?: string;
  images?: string[];
  sizes?: CasherProductSize[];
  isDeleted?: boolean;
  popularityRank?: number;
};

export function buildCasherProductImageUrl(raw?: string): string {
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `${CASHER_API_ORIGIN}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

export function isActiveCasherProduct(product: CasherProduct): boolean {
  return product.isDeleted !== true;
}

export function filterCasherProducts(
  products: CasherProduct[],
  search: string,
): CasherProduct[] {
  const q = search.trim().toLowerCase();
  const base = q
    ? products.filter((p) => (p.name ?? "").toLowerCase().includes(q))
    : products.filter(isActiveCasherProduct);
  return [...base].sort(
    (a, b) =>
      (a.popularityRank ?? Number.POSITIVE_INFINITY) -
      (b.popularityRank ?? Number.POSITIVE_INFINITY),
  );
}

export function casherProductSizeOptions(product: CasherProduct | undefined): string[] {
  if (!product) return [];
  return (product.sizes ?? [])
    .filter((s) => s.isVisible === true)
    .map((s) => (s.size ?? "").trim().toUpperCase())
    .filter(Boolean);
}

export function formatCasherProductPositionTitle(
  productName: string,
  size: string,
): string {
  const name = productName.trim();
  const sz = size.trim().toUpperCase();
  if (!name) return sz;
  if (!sz) return name;
  return `${name} · ${sz}`;
}
