import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductEditor } from "@/frontend/components/admin/product-editor";
import { ProductPricingManager } from "@/frontend/components/admin/product-pricing";
import { ProductAdminTabs } from "@/frontend/components/admin/product-tabs";
import { PageHeader } from "@/frontend/components/admin/ui";
import { isSurMesureConfigured } from "@/backend/services/pricing";
import { loadEditorOptions, loadProductForm, loadProductPricing } from "@/backend/services/product-form";

export const metadata = { title: "Modifier le produit" };

export default async function EditProduct(props: PageProps<"/admin/products/[id]">) {
  const { id } = await props.params;
  const [initial, options, pricing] = await Promise.all([loadProductForm(id), loadEditorOptions(), loadProductPricing(id)]);
  if (!initial) notFound();
  return (
    <>
      <PageHeader
        back={{ href: "/admin/products", label: "Produits" }}
        title={initial.name}
        actions={initial.status === "ACTIVE" ? <Link href={`/wall-art/${initial.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-semibold text-gold">Voir sur le site <ExternalLink className="size-3.5" /></Link> : undefined}
      />
      <ProductAdminTabs
        pricingMissing={!pricing.measures.some((r) => r.isActive && r.price > 0) && !(pricing.surMesure && isSurMesureConfigured(pricing.surMesure))}
        info={<ProductEditor key={id} id={id} initial={initial} {...options} />}
        pricing={<ProductPricingManager productId={id} measures={pricing.measures} surMesure={pricing.surMesure!} />}
      />
    </>
  );
}
