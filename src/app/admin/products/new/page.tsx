import { ProductEditor } from "@/components/admin/product-editor";
import { PageHeader } from "@/components/admin/ui";
import { EMPTY_PRODUCT, loadEditorOptions } from "@/server/services/product-form";

export const metadata = { title: "Nouveau produit" };

export default async function NewProduct() {
  const options = await loadEditorOptions();
  return (
    <>
      <PageHeader
        back={{ href: "/admin/products", label: "Produits" }}
        title="Nouveau produit"
        description="Enregistrez d'abord les informations : l'onglet « Tarification » (dimensions de 10 cm et Sur Mesure) s'ouvre ensuite."
      />
      <ProductEditor id={null} initial={EMPTY_PRODUCT} {...options} />
    </>
  );
}
