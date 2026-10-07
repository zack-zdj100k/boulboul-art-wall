"use client";

import { Archive, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";

/** Edit / archive / delete buttons for one product row. */
export function ProductRowActions({ id, name, archived, orders }: { id: string; name: string; archived: boolean; orders: number }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  const run = async (permanent: boolean) => {
    const ok = await confirm(
      permanent
        ? {
            title: `Supprimer « ${name} » ?`,
            message:
              (orders > 0 ? `Ce produit a été commandé ${orders} fois : ces commandes gardent leurs informations (nom, dimensions, prix).\n` : "") +
              "Le produit disparaîtra définitivement du site. Ses avis seront supprimés ; ses images restent dans Médias.",
            confirmLabel: "Supprimer",
            danger: true,
          }
        : { title: `Archiver « ${name} » ?`, message: "Il ne sera plus visible ni commandable, mais restera dans l'administration.", confirmLabel: "Archiver" },
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/api/admin/products/${id}${permanent ? "?permanent=1" : ""}`, { method: "DELETE" });
      toast.show(permanent ? "Produit supprimé." : "Produit archivé.", "success");
      router.refresh();
    } catch {
      toast.show("Action impossible.", "error");
    } finally {
      setBusy(false);
    }
  };

  const btn = "grid size-8 place-items-center rounded-full text-stone transition disabled:opacity-40";
  return (
    <div className="flex items-center justify-end gap-1">
      <Link href={`/admin/products/${id}`} aria-label={`Modifier ${name}`} className={`${btn} hover:bg-ivory/8 hover:text-ivory`}>
        <Pencil className="size-4" />
      </Link>
      {!archived && (
        <button type="button" onClick={() => run(false)} disabled={busy} aria-label={`Archiver ${name}`} title="Archiver" className={`${btn} hover:bg-ivory/8 hover:text-ivory`}>
          <Archive className="size-4" />
        </button>
      )}
      <button type="button" onClick={() => run(true)} disabled={busy} aria-label={`Supprimer ${name}`} title="Supprimer" className={`${btn} hover:bg-ember/12 hover:text-ember`}>
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
