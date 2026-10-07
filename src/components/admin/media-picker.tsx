"use client";

import { ImagePlus, Upload, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export type PickedMedia = { id: string; url: string; alt?: string | null };
type MediaRow = PickedMedia & { originalName: string; width: number | null; height: number | null };

const UPLOAD_ERRORS: Record<string, string> = {
  "errors.uploadType": "Format non accepté (JPG, PNG, WEBP, AVIF, GIF).",
  "errors.uploadSize": "Fichier trop lourd (10 Mo maximum).",
};

export async function uploadMedia(files: FileList | File[]): Promise<PickedMedia[]> {
  const body = new FormData();
  for (const f of Array.from(files)) body.append("file", f);
  const res = await fetch("/api/admin/media", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? "errors.generic");
  return data.items;
}

/** Library dialog: browse uploaded public images, or upload new ones, then pick. */
export function MediaPicker({ open, onClose, onPick, multiple = false }: { open: boolean; onClose: () => void; onPick: (m: PickedMedia[]) => void; multiple?: boolean }) {
  return (
    <Dialog open={open} onClose={onClose} title="Bibliothèque de médias" size="full">
      {/* Mounted only while open, so selection and list start fresh each time. */}
      {open && <PickerBody onClose={onClose} onPick={onPick} multiple={multiple} />}
    </Dialog>
  );
}

function PickerBody({ onClose, onPick, multiple }: { onClose: () => void; onPick: (m: PickedMedia[]) => void; multiple: boolean }) {
  const toast = useToast();
  const [items, setItems] = useState<MediaRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchMedia = () => api<{ media: MediaRow[] }>("/api/admin/media?visibility=PUBLIC").then((r) => r.media);
  const load = async () => {
    setItems(await fetchMedia());
    setLoading(false);
  };

  useEffect(() => {
    let alive = true;
    fetchMedia()
      .then((media) => alive && setItems(media))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const upload = async (files: FileList) => {
    setLoading(true);
    try {
      const added = await uploadMedia(files);
      await load();
      setSelected((s) => (multiple ? [...s, ...added.map((a) => a.id)] : [added[0].id]));
    } catch (e) {
      toast.show(UPLOAD_ERRORS[(e as ApiError).code] ?? "Échec de l'envoi.", "error");
      setLoading(false);
    }
  };

  const toggle = (id: string) => setSelected((s) => (multiple ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]));

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone">{multiple ? "Sélectionnez une ou plusieurs images." : "Sélectionnez une image."}</p>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" multiple={multiple} className="sr-only" onChange={(e) => e.target.files?.length && upload(e.target.files)} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} loading={loading}>
            <Upload className="size-3.5" /> Envoyer des images
          </Button>
        </div>
      </div>
      <ul className="grid max-h-[58dvh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4 lg:grid-cols-6">
        {items.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => toggle(m.id)} aria-pressed={selected.includes(m.id)} className={cn("relative block aspect-square w-full overflow-hidden rounded-art ring-2 transition", selected.includes(m.id) ? "ring-gold" : "ring-transparent hover:ring-ivory/30")}>
              <Image src={m.url} alt={m.alt ?? m.originalName} fill sizes="160px" className="object-cover" />
              {selected.includes(m.id) && <span className="absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-gold text-xs font-bold text-ink">{selected.indexOf(m.id) + 1}</span>}
            </button>
          </li>
        ))}
        {!items.length && !loading && <li className="col-span-full py-10 text-center text-sm text-stone">Aucune image — envoyez-en une.</li>}
      </ul>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        <Button
          disabled={!selected.length}
          onClick={() => {
            onPick(selected.map((id) => items.find((i) => i.id === id)!).filter(Boolean));
            onClose();
          }}
        >
          Utiliser {selected.length > 1 ? `(${selected.length})` : ""}
        </Button>
      </div>
    </div>
  );
}

/** Single image field storing a URL (CMS) or an id (catalogue), with preview. */
export function ImageField({ value, onChange, label }: { value: PickedMedia | null; onChange: (m: PickedMedia | null) => void; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-sand">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-art border border-dashed border-line-strong bg-umber-900 text-stone hover:border-ivory/40">
          {value?.url ? <Image src={value.url} alt="" fill sizes="96px" className="object-cover" /> : <ImagePlus className="size-6" />}
        </button>
        <div className="flex flex-col gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{value ? "Changer" : "Choisir une image"}</Button>
          {value && (
            <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
              <X className="size-3.5" /> Retirer
            </Button>
          )}
        </div>
      </div>
      <MediaPicker open={open} onClose={() => setOpen(false)} onPick={(m) => onChange(m[0] ?? null)} />
    </div>
  );
}
