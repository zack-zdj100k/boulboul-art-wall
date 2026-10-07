import Link from "next/link";

// Fallback for routes outside the site layout (the localized 404 lives in (site)/not-found).
export default function RootNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="eyebrow">404</p>
      <h1 className="font-display text-4xl">Page introuvable</h1>
      <Link href="/" className="rounded-full bg-ivory px-6 py-3 text-sm font-bold text-ink">Retour à l&apos;accueil</Link>
    </div>
  );
}
