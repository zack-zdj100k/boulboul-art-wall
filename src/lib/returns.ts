// Return / exchange reasons (stored in French for the team; translated on the customer side).
// These are categories only — the actual conditions are written by Boulboul in the CMS policy.
export const RETURN_REASONS = {
  WRONG_SIZE: "Mauvaise dimension",
  DAMAGED: "Abîmé à la livraison",
  DEFECT: "Défaut de fabrication",
  NOT_AS_ORDERED: "Différent de la commande",
  CHANGED_MIND: "Changement d'avis",
  OTHER: "Autre",
} as const;
export type ReturnReasonKey = keyof typeof RETURN_REASONS;
export const RETURN_REASON_KEYS = Object.keys(RETURN_REASONS) as [ReturnReasonKey, ...ReturnReasonKey[]];
