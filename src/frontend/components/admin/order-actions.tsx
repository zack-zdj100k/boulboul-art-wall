"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/frontend/components/ui/button";
import { useToast } from "@/frontend/components/ui/toast";
import { api, ApiError } from "@/frontend/lib/api-client";

const ERRORS: Record<string, string> = {
  "order.invalidTransition": "Ce changement de statut n'est pas autorisé.",
  "order.concurrentUpdate": "La commande a été modifiée entre-temps. Rechargez la page.",
  "order.sameStatus": "La commande a déjà ce statut.",
  "order.notConfirmed": "La commande n'est pas confirmée.",
};

export function RetryEmailButton({ orderId, type }: { orderId: string; type: "NEW_ORDER_ADMIN" | "ORDER_CONFIRMED_CUSTOMER" | "ORDER_DELIVERED_CUSTOMER" }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const r = await api<{ ok: boolean }>(`/api/admin/orders/${orderId}/emails`, { method: "POST", json: { type } });
          toast.show(r.ok ? "E-mail envoyé." : "Nouvel échec d'envoi — vérifiez la configuration e-mail.", r.ok ? "success" : "error");
          router.refresh();
        } catch (e) {
          toast.show(ERRORS[(e as ApiError).code] ?? "Erreur.", "error");
        } finally {
          setLoading(false);
        }
      }}
    >
      <RefreshCw className="size-3.5" /> Renvoyer
    </Button>
  );
}
