import { Download } from "lucide-react";
import { describeExtra, type ExtraSnapshot } from "@/shared/lib/options";
import { notFound } from "next/navigation";
import { CustomOrderEditor } from "@/frontend/components/admin/custom-order-editor";
import { DeleteOrderButton } from "@/frontend/components/admin/delete-order-button";
import { CUSTOM_STATUS_FR, PageHeader, Panel, StatusBadge } from "@/frontend/components/admin/ui";
import { formatDate, formatPrice } from "@/shared/i18n/config";
import { prisma } from "@/backend/db";
import { mediaUrl } from "@/backend/storage";

export const metadata = { title: "Demande sur mesure" };

export default async function AdminCustomOrder(props: PageProps<"/admin/custom-orders/[id]">) {
  const { id } = await props.params;
  const r = await prisma.customOrder.findUnique({ where: { id }, include: { designMedia: true, user: { select: { email: true } } } });
  if (!r) notFound();
  const design = r.designMedia ? mediaUrl(r.designMedia.key) : null;
  const extras = (r.extras as ExtraSnapshot[]).map(describeExtra);

  return (
    <>
      <PageHeader back={{ href: "/admin/custom-orders", label: "Demandes sur mesure" }} title={r.reference} description={`Reçue le ${formatDate(r.createdAt, "fr", true)}`} actions={
          <div className="flex items-center gap-3">
            {r.total != null && <span className="text-lg font-semibold tabular-nums">{formatPrice(r.total, "fr")}</span>}
            <StatusBadge status={r.status} labels={CUSTOM_STATUS_FR} />
            <DeleteOrderButton kind="CUSTOM" id={r.id} number={r.reference} redirectTo="/admin/orders?type=CUSTOM" />
          </div>
        } />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Panel title="Design envoyé" actions={design && <a href={design} download={r.designMedia?.originalName} className="inline-flex items-center gap-1 text-xs font-semibold text-gold"><Download className="size-3.5" /> Télécharger</a>}>
            {design ? (
              // eslint-disable-next-line @next/next/no-img-element -- private file behind the authorised /media route
              <img src={design} alt={`Design de ${r.customerName}`} className="max-h-[70vh] w-full rounded-art bg-umber-900 object-contain" />
            ) : (
              <p className="text-sm text-stone">Pas d&apos;image — le client a décrit son idée.</p>
            )}
          </Panel>
          <Panel title="La demande">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-stone">Description</dt><dd className="whitespace-pre-line">{r.description || "—"}</dd>
              <dt className="text-stone">Dimensions</dt><dd className="tabular-nums">{r.widthCm && r.heightCm ? `${r.widthCm} × ${r.heightCm} cm` : r.widthCm || r.heightCm ? `${r.widthCm ?? "?"} × ${r.heightCm ?? "?"} cm` : "Non précisées"}</dd>
              <dt className="text-stone">Cadre</dt><dd>{r.frameName ?? "Pas de préférence"}</dd>
              <dt className="text-stone">Options</dt><dd>{extras.length ? extras.join(", ") : "Aucune"}</dd>
              {r.otherIdea && (<><dt className="text-stone">Autre idée</dt><dd className="whitespace-pre-line">{r.otherIdea}</dd></>)}
              {r.notes && (<><dt className="text-stone">Remarques</dt><dd className="whitespace-pre-line">{r.notes}</dd></>)}
            </dl>
          </Panel>
        </div>
        <div className="flex flex-col gap-6">
          <Panel title="Client">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-stone">Nom</dt><dd className="font-semibold">{r.customerName}</dd>
              <dt className="text-stone">Téléphone</dt><dd><a href={`tel:${r.phone}`} className="text-gold hover:underline tabular-nums">{r.phone}</a></dd>
              <dt className="text-stone">E-mail</dt><dd><a href={`mailto:${r.email}`} className="text-gold hover:underline">{r.email}</a></dd>
              <dt className="text-stone">Adresse</dt><dd>{[r.address, r.commune, r.wilayaName].filter(Boolean).join(", ") || "—"}</dd>
              <dt className="text-stone">Compte</dt><dd>{r.user ? "Client inscrit" : "Invité"}</dd>
            </dl>
          </Panel>
          <Panel title="Devis & suivi">
            <CustomOrderEditor
              id={r.id}
              estimate={r.estimatedPrice}
              initial={{ status: r.status, adminNotes: r.adminNotes ?? "", price: r.price, discountType: r.discountType, discountValue: r.discountValue, deliveryFee: r.deliveryFee }}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
