"use client";

import { Copy, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/frontend/components/ui/button";
import { useConfirm } from "@/frontend/components/ui/confirm";
import { useToast } from "@/frontend/components/ui/toast";
import { api, ApiError } from "@/frontend/lib/api-client";
import { uploadMedia } from "./media-picker";

type M = { id: string; url: string; alt: string | null; originalName: string; mime: string; size: number; width: number | null; height: number | null; usage: number; key: string };

export function MediaLibrary({ media, privateView }: { media: M[]; privateView: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (files: FileList) => {
    setBusy(true);
    try {
      const added = await uploadMedia(files);
      toast.show(`${added.length} image(s) ajoutée(s).`, "success");
      router.refresh();
    } catch (e) {
      const code = (e as ApiError).code;
      toast.show(code === "errors.uploadType" ? "Format non accepté." : code === "errors.uploadSize" ? "Fichier trop lourd (10 Mo max)." : "Échec de l'envoi.", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: M) => {
    const ok = await confirm({
      title: "Supprimer cette image ?",
      message:
        m.usage > 0
          ? `Cette image est utilisée ${m.usage} fois (produit, catégorie, cadre ou demande sur mesure).\nLa supprimer la retirera de ces éléments.`
          : `« ${m.originalName} » sera supprimée définitivement.`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/admin/media/${m.id}${m.usage > 0 ? "?force=1" : ""}`, { method: "DELETE" });
      toast.show("Image supprimée.", "success");
      router.refresh();
    } catch (e) {
      const code = (e as ApiError).code;
      toast.show(code === "media.inCms" ? "Image utilisée dans le contenu du site (CMS) — remplacez-la d'abord dans Contenu." : "Suppression impossible.", "error");
    }
  };

  const saveAlt = async (m: M, alt: string) => {
    if (alt === (m.alt ?? "")) return;
    await api(`/api/admin/media/${m.id}`, { method: "PATCH", json: { alt } }).then(() => toast.show("Texte alternatif enregistré.", "success")).catch(() => toast.show("Erreur.", "error"));
  };

  return (
    <div className="flex flex-col gap-5">
      {!privateView && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
          }}
          className="flex flex-col items-center gap-3 rounded-panel border-2 border-dashed border-line-strong p-8 text-center"
        >
          <p className="text-sm text-sand">Glissez des images ici (JPG, PNG, WEBP, AVIF, GIF — 10 Mo max.)</p>
          <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="sr-only" onChange={(e) => e.target.files?.length && upload(e.target.files)} />
          <Button size="sm" onClick={() => fileRef.current?.click()} loading={busy}><Upload className="size-4" /> Choisir des fichiers</Button>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {media.map((m) => (
          <li key={m.id} className="flex flex-col overflow-hidden rounded-panel border border-line bg-ink/60">
            <div className="relative aspect-square bg-umber-800">
              <Image src={m.url} alt={m.alt ?? ""} fill sizes="240px" unoptimized={privateView} className="object-cover" />
              <span className="absolute start-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-bold">{m.usage > 0 ? `Utilisée ×${m.usage}` : "Non utilisée"}</span>
            </div>
            <div className="flex flex-col gap-2 p-3 text-xs">
              <p className="truncate font-semibold" title={m.originalName}>{m.originalName}</p>
              <p className="text-stone">{m.width && m.height ? `${m.width}×${m.height} · ` : ""}{(m.size / 1024).toFixed(0)} Ko</p>
              {!privateView && (
                <input defaultValue={m.alt ?? ""} placeholder="Texte alternatif…" aria-label="Texte alternatif" onBlur={(e) => saveAlt(m, e.target.value)} className="h-8 rounded-md border border-line bg-umber-900 px-2 text-xs focus:border-gold focus:outline-none" />
              )}
              <div className="flex gap-1">
                <button type="button" onClick={() => navigator.clipboard.writeText(m.url).then(() => toast.show("URL copiée.", "success"))} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-line py-1.5 text-sand hover:text-ivory"><Copy className="size-3" /> URL</button>
                <button type="button" onClick={() => remove(m)} className="inline-flex items-center justify-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-sand hover:border-ember/50 hover:text-ember" aria-label={`Supprimer ${m.originalName}`}><Trash2 className="size-3" /> Supprimer</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
