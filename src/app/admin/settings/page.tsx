import { DeliveryRulesManager, ExtrasManager, FramesManager } from "@/components/admin/catalog-managers";
import { EmailSettingsForm, GeneralSettingsForm, PurgeDemoButton } from "@/components/admin/settings-forms";
import { PageHeader, Panel } from "@/components/admin/ui";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { getAllSettings } from "@/server/services/settings";
import { hasDemoData } from "@/server/services/stats";
import { mediaUrl } from "@/server/storage";

export const metadata = { title: "Paramètres" };

export default async function AdminSettings() {
  const [settings, frames, extras, rules, demo] = await Promise.all([
    getAllSettings(),
    prisma.frameOption.findMany({ orderBy: { sortOrder: "asc" }, include: { image: true } }),
    prisma.extraOption.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.deliveryRule.findMany({ orderBy: [{ wilayaCode: "asc" }, { commune: "asc" }] }),
    hasDemoData(),
  ]);
  const strip = <T extends { createdAt: Date; updatedAt: Date }>({ createdAt: _c, updatedAt: _u, ...rest }: T) => rest;

  return (
    <>
      <PageHeader title="Paramètres" description="Options de fabrication, livraison, demandes personnalisées et configuration technique." />
      <div className="flex flex-col gap-6">
        <Panel title="Livraison">
          <p className="mb-4 text-sm text-sand">
            Les frais sont calculés à partir de ces règles (la plus précise l&apos;emporte : commune &gt; wilaya &gt; défaut). Sans règle, le client voit « à confirmer par Boulboul » et le total n&apos;inclut pas la livraison.
          </p>
          <DeliveryRulesManager items={rules.map(strip)} />
        </Panel>
        <Panel title="Cadres">
          <FramesManager items={frames.map(({ image, ...f }) => ({ ...strip(f), imageUrl: image ? mediaUrl(image.key) : "" }))} />
        </Panel>
        <Panel title="Options (LED, miroir, accessoires…)">
          <ExtrasManager items={extras.map(strip)} />
        </Panel>
        <Panel title="Demandes de design personnalisé">
          <p className="mb-4 text-sm text-sand">
            Formulaire « Créer mon design » : limites des dimensions et estimation affichée au client (prix stable à la mesure de référence, ± un montant par 10 cm de longueur et de hauteur, + options). Vous confirmez ensuite le devis dans Commandes. Les prix des produits se règlent dans chaque produit, onglet « Tarification ».
          </p>
          <GeneralSettingsForm initial={Object.fromEntries(Object.entries(settings).filter(([k]) => k.startsWith("custom."))) as Record<string, number>} />
        </Panel>
        <Panel title="E-mails & notifications">
          <div id="emails" className="flex flex-col gap-6">
            <EmailSettingsForm
              fallbackAdmin={env.ADMIN_EMAIL}
              provider={env.EMAIL_PROVIDER}
              initial={{
                "email.adminRecipients": settings["email.adminRecipients"],
                "email.fromName": settings["email.fromName"],
                "email.customerConfirmed": settings["email.customerConfirmed"],
                "email.customerDelivered": settings["email.customerDelivered"],
              }}
            />
          </div>
        </Panel>
        <Panel title="Données de démonstration" className={demo ? "border-gold/40" : ""}>
          <div id="demo" className="flex flex-col items-start gap-4 text-sm text-sand">
            {demo ? (
              <>
                <p>Le site contient des données de démonstration créées par le script de seed (marquées « Démo »). Leurs prix ne sont pas vos prix réels.</p>
                <PurgeDemoButton />
              </>
            ) : (
              <p>Aucune donnée de démonstration.</p>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
