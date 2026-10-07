export default function Loading() {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center" role="status" aria-label="Chargement">
      <span className="relative block h-px w-24 overflow-hidden bg-line">
        <span className="absolute inset-0 animate-sweep bg-gold" />
      </span>
    </div>
  );
}
