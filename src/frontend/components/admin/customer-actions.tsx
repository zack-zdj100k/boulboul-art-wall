"use client";

import { MoreHorizontal, Pencil, ShieldCheck, ShieldOff, Trash2, UserCheck, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/frontend/components/ui/button";
import { useConfirm } from "@/frontend/components/ui/confirm";
import { Dialog } from "@/frontend/components/ui/dialog";
import { fieldClasses } from "@/frontend/components/ui/field";
import { useToast } from "@/frontend/components/ui/toast";
import { api, ApiError } from "@/frontend/lib/api-client";
import { cn } from "@/shared/lib/utils";

const ERRORS: Record<string, string> = {
  "users.self": "Vous ne pouvez pas retirer votre propre accès ni supprimer votre compte.",
  "users.lastAdmin": "Il doit rester au moins un administrateur actif.",
  "errors.emailTaken": "Cette adresse e-mail est déjà utilisée par un autre compte.",
  "validation.invalid": "Valeurs invalides (téléphone algérien, âge 13–120…).",
};
const msg = (e: unknown) => ERRORS[(e as ApiError).code] ?? (Object.values((e as ApiError).fields ?? {})[0] ? "Valeurs invalides." : "Action impossible.");

type Customer = { id: string; fullName: string; email: string; phone: string | null; age: number | null; role: "CUSTOMER" | "ADMIN"; isActive: boolean; orders: number };

/** Edit / make admin / deactivate / delete a user account. */
export function CustomerActions({ c, isSelf }: { c: Customer; isSelf: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ fullName: c.fullName, email: c.email, phone: c.phone ?? "", age: c.age?.toString() ?? "" });

  const call = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.show(ok, "success");
      router.refresh();
      return true;
    } catch (e) {
      toast.show(msg(e), "error");
      return false;
    } finally {
      setBusy(false);
      setMenu(false);
    }
  };
  const patch = (json: Record<string, unknown>, ok: string) => call(() => api(`/api/admin/customers/${c.id}`, { method: "PATCH", json }), ok);
  const item = "flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm hover:bg-ivory/8 disabled:opacity-40";
  const input = cn(fieldClasses, "h-11 font-normal");

  return (
    <div className="relative">
      <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label={`Actions pour ${c.fullName}`} className="grid size-9 place-items-center rounded-full text-sand hover:bg-ivory/8 hover:text-ivory">
        <MoreHorizontal className="size-4" />
      </button>
      {menu && (
        <>
          <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} />
          <div role="menu" className="absolute end-0 z-20 mt-1 flex w-60 flex-col rounded-field border border-line bg-umber-950 p-1 shadow-lifted">
            <button role="menuitem" type="button" className={item} onClick={() => { setEdit(true); setMenu(false); }}>
              <Pencil className="size-4" /> Modifier
            </button>
            {c.role === "CUSTOMER" ? (
              <button
                role="menuitem"
                type="button"
                className={item}
                disabled={busy}
                onClick={async () => {
                  if (await confirm({ title: `Rendre ${c.fullName} administrateur ?`, message: "Ce compte aura accès à toute l'administration (commandes, clients, prix, contenu).", confirmLabel: "Rendre administrateur" }))
                    await patch({ role: "ADMIN" }, "Compte administrateur.");
                }}
              >
                <ShieldCheck className="size-4" /> Rendre administrateur
              </button>
            ) : (
              <button role="menuitem" type="button" className={item} disabled={busy || isSelf} onClick={() => patch({ role: "CUSTOMER" }, "Droits administrateur retirés.")}>
                <ShieldOff className="size-4" /> Retirer les droits admin
              </button>
            )}
            {c.isActive ? (
              <button role="menuitem" type="button" className={item} disabled={busy || isSelf} onClick={() => patch({ isActive: false }, "Compte désactivé.")}>
                <UserX className="size-4" /> Désactiver le compte
              </button>
            ) : (
              <button role="menuitem" type="button" className={item} disabled={busy} onClick={() => patch({ isActive: true }, "Compte réactivé.")}>
                <UserCheck className="size-4" /> Réactiver le compte
              </button>
            )}
            <button
              role="menuitem"
              type="button"
              className={cn(item, "text-ember")}
              disabled={busy || isSelf}
              onClick={async () => {
                const ok = await confirm({
                  title: `Supprimer le compte de ${c.fullName} ?`,
                  message: `Le compte est supprimé définitivement. ${c.orders ? `Ses ${c.orders} commande(s) sont conservées (nom, adresse et prix y sont enregistrés) mais ne seront plus liées à un compte.` : ""}`,
                  confirmLabel: "Supprimer",
                  danger: true,
                });
                if (ok) await call(() => api(`/api/admin/customers/${c.id}`, { method: "DELETE" }), "Compte supprimé.");
              }}
            >
              <Trash2 className="size-4" /> Supprimer
            </button>
          </div>
        </>
      )}

      <Dialog open={edit} onClose={() => !busy && setEdit(false)} title={`Modifier ${c.fullName}`}>
        <form
          className="flex flex-col gap-4 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await patch({ fullName: f.fullName, email: f.email, phone: f.phone, age: f.age }, "Compte mis à jour.")) setEdit(false);
          }}
        >
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-sand">Nom complet<input required minLength={2} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} className={input} /></label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-sand">E-mail<input required type="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-sand">Téléphone<input type="tel" dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={input} /></label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-sand">Âge<input type="number" min={13} max={120} value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} className={input} /></label>
          </div>
          <p className="text-xs text-stone">Le mot de passe n&apos;est jamais visible ni modifiable ici.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEdit(false)} disabled={busy}>Annuler</Button>
            <Button type="submit" loading={busy}>Enregistrer</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
