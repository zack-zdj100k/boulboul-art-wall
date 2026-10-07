"use client";

// Last-resort boundary (root layout failed). No stack traces are shown to visitors.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ background: "#faf7f0", color: "#252522", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontWeight: 400 }}>Une erreur est survenue.</h1>
          <button onClick={reset} style={{ marginTop: 16, padding: "12px 24px", borderRadius: 999, border: 0, background: "#252522", color: "#faf7f0", fontWeight: 700, cursor: "pointer" }}>
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
