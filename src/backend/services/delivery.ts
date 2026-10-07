// DeliveryService — fees come exclusively from admin-configured rules (no hardcoded prices).
// Two methods: à domicile (`fee`) and stop desk (`stopDeskFee`, null = not offered there).

export type DeliveryMethod = "HOME" | "STOP_DESK";

export type DeliveryRuleLike = {
  id: string;
  wilayaCode: string | null;
  commune: string | null;
  fee: number;
  stopDeskFee?: number | null;
  returnFee?: number | null;
  freeAbove: number | null;
  isActive: boolean;
};

export type DeliveryQuote = {
  /** null = no rule (or method not offered): Boulboul confirms the fee with the customer. */
  fee: number | null;
  free: boolean;
  ruleId: string | null;
  method: DeliveryMethod;
  /** Prices of both methods for this destination (null = not offered / not configured). */
  home: number | null;
  stopDesk: number | null;
};

export const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

export function findDeliveryRule<T extends DeliveryRuleLike>(rules: T[], wilayaCode: string, commune: string): T | null {
  const active = rules.filter((r) => r.isActive);
  const c = norm(commune);
  return (
    active.find((r) => r.wilayaCode === wilayaCode && r.commune && norm(r.commune) === c) ??
    active.find((r) => r.wilayaCode === wilayaCode && !r.commune) ??
    active.find((r) => !r.wilayaCode && !r.commune) ??
    null
  );
}

export function quoteDelivery(rules: DeliveryRuleLike[], wilayaCode: string, commune: string, subtotal: number, method: DeliveryMethod = "HOME"): DeliveryQuote {
  const rule = findDeliveryRule(rules, wilayaCode, commune);
  if (!rule) return { fee: null, free: false, ruleId: null, method, home: null, stopDesk: null };
  const free = rule.freeAbove != null && subtotal >= rule.freeAbove;
  const home = free ? 0 : rule.fee;
  const stopDesk = rule.stopDeskFee == null ? null : free ? 0 : rule.stopDeskFee;
  const fee = method === "STOP_DESK" ? stopDesk : home;
  return { fee, free: free && fee != null, ruleId: rule.id, method, home, stopDesk };
}
