import "server-only";
import { parseColors, type ExtraChoice, type ExtraSnapshot } from "@/lib/options";
import { badRequest } from "@/server/http";

type ExtraRow = { id: string; name: string; colors: unknown; askNote: boolean };

/**
 * Attach the customer's colour / note to each chosen option, validated against the
 * option's configuration: the colour must be one the admin offers (required when the
 * option has colours); notes are only kept for options that ask for one.
 */
export function snapshotExtras(chosen: { id: string; name: string; price?: number }[], rows: ExtraRow[], choices: ExtraChoice[] = []): ExtraSnapshot[] {
  return chosen.map((e) => {
    const row = rows.find((r) => r.id === e.id);
    const choice = choices.find((c) => c.id === e.id);
    const colors = row ? parseColors(row.colors) : [];
    let color: string | null = null;
    if (colors.length) {
      const picked = colors.find((c) => c.name === choice?.color);
      if (!picked) throw badRequest("errors.invalidOption", { extraChoices: "errors.chooseColor" });
      color = picked.name;
    }
    const note = row?.askNote && choice?.note?.trim() ? choice.note.trim().slice(0, 300) : null;
    return { ...e, ...(color ? { color } : {}), ...(note ? { note } : {}) };
  });
}
