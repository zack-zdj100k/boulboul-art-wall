import { CategoriesManager } from "@/frontend/components/admin/catalog-managers";
import { PageHeader } from "@/frontend/components/admin/ui";
import { prisma } from "@/backend/db";
import { mediaUrl } from "@/backend/storage";

export const metadata = { title: "Catégories" };

export default async function AdminCategories() {
  const rows = await prisma.category.findMany({ orderBy: { sortOrder: "asc" }, include: { image: true, _count: { select: { products: true } } } });
  const items = rows.map(({ image, _count, createdAt: _c, updatedAt: _u, ...c }) => ({ ...c, imageUrl: image ? mediaUrl(image.key) : "", productCount: _count.products }));
  return (
    <>
      <PageHeader title="Catégories" description="Collections affichées dans la boutique et sur l'accueil. Les catégories sans produit actif ne sont pas affichées publiquement." />
      <CategoriesManager items={items} />
    </>
  );
}
