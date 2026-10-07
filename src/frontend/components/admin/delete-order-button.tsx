"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/frontend/components/ui/button";
import { Dialog } from "@/frontend/components/ui/dialog";
import { useToast } from "@/frontend/components/ui/toast";
import { api } from "@/frontend/lib/api-client";

/** Delete a catalogue order or a custom request, after an explicit confirmation. */
export function DeleteOrderButton({
  kind,
  id,
  number,
  compact = false,
  redirectTo,
}: {
  kind: "ORDER" | "CUSTOM";
  id: string;
  number: string;
  compact?: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const remove = async () => {
    setLoading(true);
    try {
      await api(kind === "ORDER" ? `/api/admin/orders/${id}` : `/api/admin/custom-orders/${id}`, { method: "DELETE" });
      toast.show(`${number} supprimée.`, "success");
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch {
      toast.show("Suppression impossible.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {compact ? (
        <button type="button" onClick={() => setOpen(true)} aria-label={`Supprimer ${number}`} className="grid size-8 place-items-center rounded-full text-stone transition hover:bg-ember/12 hover:text-ember">
          <Trash2 className="size-4" />
        </button>
      ) : (
        <Button variant="danger" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" /> Supprimer
        </Button>
      )}
      <Dialog open={open} onClose={() => !loading && setOpen(false)} title={`Supprimer ${number} ?`}>
        <div className="flex flex-col gap-5 p-6 text-sm">
          <p className="text-sand">
            {kind === "ORDER"
              ? "La commande, ses articles et son historique seront supprimés définitivement. Les statistiques et le chiffre d'affaires seront recalculés sans elle."
              : "La demande et le design envoyé par le client seront supprimés définitivement."}
          </p>
          <p className="rounded-field border border-line bg-umber-900 p-3 text-xs text-stone">
            Pour simplement arrêter {kind === "ORDER" ? "la commande, passez-la en « Annulée »" : "la demande, passez-la en « Refusée »"} : elle restera dans l&apos;historique.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Annuler
            </Button>
            <Button variant="danger" onClick={remove} loading={loading}>
              Supprimer définitivement
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
