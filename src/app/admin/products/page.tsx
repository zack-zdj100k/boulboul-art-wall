import { AlertTriangle, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { Empty, PageHeader, Table } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatPrice } from "@/i18n/config";
import { prisma } from "@/server/db";
import { isSurMesureConfigured, startingPrice, surMesureFromProduct } from "@/server/services/pricing";
import { mediaUrl } from "@/server/storage";

export const metadata = { title: "Produits" };

const STATUS: Record<string, { label: string; tone: "sage" | "outline" | "ember" }> = {
  ACTIVE: { label: "En ligne", tone: "sage" },
  DRAFT: { label: "Brouillon", tone: "outline" },
  ARCHIVED: { label: "Archivé", tone: "ember" },
};

const active = { where: { isActive: true, price: { gt: 0 } }, select: { id: true, widthCm: true, heightCm: true, price: true, isActive: true, label: true } } as const;

export default async function AdminProducts(props: PageProps<"/admin/products">) {
  const sp = await props.searchParams;
  const onlyMissing = sp.pricing === "missing";
  const products = await prisma.product.findMany({
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      category: { select: { name: true } },
      images: { include: { media: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      measures: active,
      _count: { select: { orderItems: true } },
    },
  });
  const now = new Date();
  const rows = products
    .map((p) => ({ ...p, surMesure: surMesureFromProduct(p), from: startingPrice({ ...p, surMesure: surMesureFromProduct(p) }, now) }))
    .filter((p) => !onlyMissing || !p.from);
  const missing = products.filter((p) => p.status === "ACTIVE" && !startingPrice({ ...p, surMesure: surMesureFromProduct(p) }, now)).length;
  return (
    <>
      <PageHeader title="Produits" description="Créez, modifiez, mettez en avant ou archivez vos créations." actions={<ButtonLink href="/admin/products/new" size="sm"><Plus className="size-4" /> Nouveau produit</ButtonLink>} />
      {missing > 0 && (
        <p className="mb-5 flex items-start gap-3 rounded-panel border border-ember/50 bg-ember/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-ember" />
          <span>
            {missing} produit(s) en ligne n&apos;ont <strong>aucun prix configuré</strong> : aucun prix n&apos;est affiché et ils ne peuvent pas être commandés.{" "}
            {onlyMissing ? <Link href="/admin/products" className="font-semibold underline">Voir tous les produits</Link> : <Link href="/admin/products?pricing=missing" className="font-semibold underline">Les afficher</Link>}
          </span>
        </p>
      )}
      {rows.length ? (
        <Table>
          <thead>
            <tr><th></th><th>Produit</th><th>Catégorie</th><th>Tarification</th><th>Statut</th><th>Commandes</th><th><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="w-16">
                  <span className="relative block size-12 overflow-hidden rounded-art bg-umber-800">
                    {p.images[0] && <Image src={mediaUrl(p.images[0].media.key)} alt="" fill sizes="48px" className="object-cover" />}
                  </span>
                </td>
                <td>
                  <Link href={`/admin/products/${p.id}`} className="font-semibold text-ivory hover:text-gold">{p.name}</Link>
                  <span className="ms-2 inline-flex gap-1">{p.isFeatured && <Badge tone="gold">Accueil</Badge>}{p.isDemo && <Badge tone="demo">Démo</Badge>}</span>
                  <span className="block text-xs text-stone">/{p.slug}</span>
                </td>
                <td>{p.category?.name ?? "—"}</td>
                <td className="tabular-nums">
                  {p.from ? (
                    <>
                      <span className="text-xs text-stone">À partir de </span>
                      {formatPrice(p.from.final, "fr")}
                      <span className="block text-xs text-stone">
                        {p.measures.length} mesure(s) ·{" "}
                        {isSurMesureConfigured(p.surMesure) ? (
                          <span className="text-sage">Sur Mesure actif</span>
                        ) : (
                          <Link href={`/admin/products/${p.id}#tarification`} className="text-gold hover:underline">Sur Mesure inactif</Link>
                        )}
                      </span>
                    </>
                  ) : (
                    <Link href={`/admin/products/${p.id}#tarification`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ember hover:underline">
                      <AlertTriangle className="size-3.5" /> Aucun prix configuré
                    </Link>
                  )}
                </td>
                <td><Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge></td>
                <td className="tabular-nums">{p._count.orderItems}</td>
                <td>
                  <ProductRowActions id={p.id} name={p.name} archived={p.status === "ARCHIVED"} orders={p._count.orderItems} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>Aucun produit. Commencez par en créer un.</Empty>
      )}
    </>
  );
}
