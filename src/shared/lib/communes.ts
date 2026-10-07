// Algeria's 1,541 communes by wilaya (58-wilaya division used by the carriers).
// Source and licence: src/shared/lib/algeria-communes.json (geoalgeria, MIT).

export type Commune = [fr: string, ar: string];
type Data = { communes: Record<string, Commune[]> };

/** Case/accent-insensitive key: "BAB EZZOUAR", "bab-ezzouar " → "bab ezzouar". */
export const placeKey = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

let cache: Promise<Data> | null = null;
/** Lazy-loaded so the list (~50 KB) is only fetched where a commune is chosen. */
export function loadCommunes() {
  cache ??= import("./algeria-communes.json").then((m) => (m.default ?? m) as unknown as Data);
  return cache;
}

/** Official French name of the commune in that wilaya, or null if it is not one of its communes. */
export async function findCommune(wilayaCode: string, value: string | null | undefined) {
  if (!value) return null;
  const list = (await loadCommunes()).communes[wilayaCode] ?? [];
  const k = placeKey(value);
  return list.find(([fr, ar]) => placeKey(fr) === k || ar === value.trim())?.[0] ?? null;
}
