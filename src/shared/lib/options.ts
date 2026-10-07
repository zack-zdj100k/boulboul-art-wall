// Option (extra) details shared by the configurator, the custom form and the server.

export type OptionColor = { name: string; hex: string };

/** Safely read the `colors` JSON of an ExtraOption. */
export function parseColors(value: unknown): OptionColor[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c): c is { name: unknown; hex: unknown } => !!c && typeof c === "object")
    .map((c) => ({ name: String(c.name ?? "").trim().slice(0, 40), hex: String(c.hex ?? "").trim() }))
    .filter((c) => c.name && /^#[0-9a-f]{6}$/i.test(c.hex));
}

/** What the customer picked for one option. */
export type ExtraChoice = { id: string; color?: string | null; note?: string | null };

/** Snapshot stored on order items / custom requests. */
export type ExtraSnapshot = { id: string; name: string; price?: number; color?: string | null; note?: string | null };

export function describeExtra(e: ExtraSnapshot) {
  return [e.name, e.color ? `(${e.color})` : null, e.note ? `— « ${e.note} »` : null].filter(Boolean).join(" ");
}
