import { Lightbulb, Monitor, Smartphone, Tablet } from "lucide-react";
import Link from "next/link";
import { CampaignLinkBuilder } from "@/frontend/components/admin/campaign-link-builder";
import { SocialIcon, type SocialNetwork } from "@/frontend/components/site/social-icon";
import { Empty, PageHeader, Panel, Table } from "@/frontend/components/admin/ui";
import { formatPrice } from "@/shared/i18n/config";
import { sourceInfo } from "@/shared/lib/traffic";
import { cn } from "@/shared/lib/utils";
import { prisma } from "@/backend/db";
import { getTrafficReport, type SourceRow, type TrafficReport } from "@/backend/services/traffic";

export const metadata = { title: "Réseaux sociaux" };

const PERIODS = [7, 30, 90, 365] as const;
const DECLARED: Record<string, string> = { TIKTOK: "TikTok", INSTAGRAM: "Instagram", FACEBOOK: "Facebook", OTHER: "Autre" };
const DEVICES: Record<string, { label: string; icon: typeof Monitor }> = {
  mobile: { label: "Mobile", icon: Smartphone },
  tablet: { label: "Tablette", icon: Tablet },
  desktop: { label: "Ordinateur", icon: Monitor },
};

const pct = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);
const fmtPct = (v: number) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: v < 10 ? 1 : 0 })} %`;
const da = (v: number) => formatPrice(v, "fr");

function Dot({ source }: { source: string }) {
  return <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: sourceInfo(source).color }} aria-hidden />;
}


// The networks Boulboul publishes on, always shown (even at 0) so the comparison is complete.
const NETWORKS = ["instagram", "tiktok", "facebook", "snapchat", "youtube", "whatsapp", "google"] as const;
const ICONS: Partial<Record<string, SocialNetwork>> = { instagram: "instagram", tiktok: "tiktok", facebook: "facebook", youtube: "youtube" };

function NetworkIcon({ source }: { source: string }) {
  const icon = ICONS[source];
  const { color, label } = sourceInfo(source);
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full text-paper" style={{ background: color }}>
      {icon ? <SocialIcon network={icon} className="size-5" /> : <span className="text-sm font-bold">{label[0]}</span>}
    </span>
  );
}

/** Share of visits per source, as a donut. */
function Donut({ rows, total }: { rows: SourceRow[]; total: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" className="size-44 shrink-0 -rotate-90" role="img" aria-label="Part des visites par source">
      <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="12" className="text-umber-800" />
      {total > 0 &&
        rows
          .filter((s) => s.visits > 0)
          .map((s) => {
            const len = (s.visits / total) * c;
            const el = <circle key={s.source} cx="50" cy="50" r={r} fill="none" stroke={sourceInfo(s.source).color} strokeWidth="12" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />;
            offset += len;
            return el;
          })}
    </svg>
  );
}

/** Factual observations only (no invented benchmark): biggest source, best conversion, sales. */
function insights(r: TrafficReport) {
  const out: string[] = [];
  const known = r.sources.filter((s) => s.source !== "unknown");
  const byVisits = [...known].sort((a, b) => b.visits - a.visits)[0];
  if (byVisits && byVisits.visits > 0) out.push(`${sourceInfo(byVisits.source).label} vous apporte le plus de visites : ${fmtPct(pct(byVisits.visits, r.totals.visits))} du trafic.`);
  const converting = known.filter((s) => s.visitors >= 20 && s.orders > 0).sort((a, b) => b.orders / b.visitors - a.orders / a.visitors)[0];
  if (converting) out.push(`Meilleur taux de conversion : ${sourceInfo(converting.source).label} (${fmtPct(pct(converting.orders, converting.visitors))} des visiteurs passent commande).`);
  const sales = [...known].sort((a, b) => b.revenue - a.revenue)[0];
  if (sales && sales.revenue > 0) out.push(`${sourceInfo(sales.source).label} génère le plus de ventes livrées : ${da(sales.revenue)}.`);
  const traffickedNoSales = known.filter((s) => s.visitors >= 50 && s.orders === 0).map((s) => sourceInfo(s.source).label);
  if (traffickedNoSales.length) out.push(`Beaucoup de visites mais aucune commande depuis : ${traffickedNoSales.join(", ")}. Vérifiez la page d'arrivée et l'offre de ces publications.`);
  return out;
}

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  const sp = await searchParams;
  const days = PERIODS.find((p) => String(p) === sp.days) ?? 30;
  const [r, products] = await Promise.all([
    getTrafficReport(days),
    prisma.product.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 40, select: { slug: true, name: true } }),
  ]);
  const t = r.totals;
  const maxDay = Math.max(1, ...r.daily.map((d) => Object.values(d.bySource).reduce((a, b) => a + b, 0)));
  const chartSources = r.sources.filter((s) => s.visits > 0).map((s) => s.source);
  const notes = insights(r);
  const empty: Omit<SourceRow, "source"> = { visits: 0, visitors: 0, signups: 0, orders: 0, ordersValue: 0, delivered: 0, revenue: 0 };
  const networkRows = NETWORKS.map((n) => r.sources.find((s) => s.source === n) ?? { source: n, ...empty }).sort((a, b) => b.orders - a.orders || b.visits - a.visits);
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";

  const cards = [
    { label: "Visites", value: t.visits.toLocaleString("fr-FR"), sub: "sessions de navigation" },
    { label: "Visiteurs uniques", value: t.visitors.toLocaleString("fr-FR") },
    { label: "Comptes créés", value: t.signups.toLocaleString("fr-FR") },
    { label: "Commandes", value: t.orders.toLocaleString("fr-FR"), sub: `${da(t.ordersValue)} (hors annulées)` },
    { label: "Taux de conversion", value: t.visitors ? fmtPct(pct(t.measuredOrders, t.visitors)) : "—", sub: "commandes mesurées / visiteurs" },
    { label: "Ventes livrées", value: da(t.revenue), sub: `${t.delivered} commande(s) livrée(s)` },
  ];

  return (
    <>
      <PageHeader
        title="Réseaux sociaux"
        description="D'où viennent vos visiteurs et vos clients : Instagram, TikTok, Facebook, Google… Mesuré automatiquement sur le site, pour savoir où publier et quelles publications booster."
        actions={PERIODS.map((p) => (
          <Link
            key={p}
            href={`/admin/analytics?days=${p}`}
            aria-current={p === days ? "page" : undefined}
            className={cn("rounded-full border px-4 py-1.5 text-xs font-semibold", p === days ? "border-ivory bg-ivory text-ink" : "border-line text-sand hover:text-ivory")}
          >
            {p === 365 ? "12 mois" : `${p} jours`}
          </Link>
        ))}
      />

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-panel border border-line bg-ink/60 p-5">
            <p className="text-xs font-semibold text-stone">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums md:text-3xl">{c.value}</p>
            {c.sub && <p className="mt-1 text-xs text-sand">{c.sub}</p>}
          </div>
        ))}
      </div>

      <Panel title="Vos réseaux sociaux" className="mb-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="relative grid place-items-center self-center">
            <Donut rows={r.sources} total={t.visits} />
            <div className="absolute text-center">
              <p className="text-2xl font-semibold tabular-nums">{t.visits}</p>
              <p className="text-[11px] text-stone">visites</p>
            </div>
          </div>
          <ol className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {networkRows.map((s, i) => (
              <li key={s.source} className={cn("flex flex-col gap-3 rounded-field border p-4", i === 0 && s.visits > 0 ? "border-gold/50 bg-gold/5" : "border-line")}>
                <div className="flex items-center gap-3">
                  <NetworkIcon source={s.source} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{sourceInfo(s.source).label}</p>
                    <p className="text-xs text-stone">{s.visits ? `${fmtPct(pct(s.visits, t.visits))} des visites` : "aucune visite"}</p>
                  </div>
                  {s.visits > 0 && <span className="text-xs font-bold text-gold tabular-nums">#{i + 1}</span>}
                </div>
                <span className="h-1.5 overflow-hidden rounded-full bg-umber-800">
                  <span className="block h-full rounded-full" style={{ width: `${pct(s.visits, t.visits)}%`, background: sourceInfo(s.source).color }} />
                </span>
                <dl className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div><dt className="text-stone">Visites</dt><dd className="text-base font-semibold tabular-nums">{s.visits}</dd></div>
                  <div><dt className="text-stone">Comptes</dt><dd className="text-base font-semibold tabular-nums">{s.signups}</dd></div>
                  <div><dt className="text-stone">Commandes</dt><dd className="text-base font-semibold tabular-nums">{s.orders}</dd></div>
                  <div><dt className="text-stone">Conversion</dt><dd className="text-base font-semibold tabular-nums">{s.visitors ? fmtPct(pct(s.orders, s.visitors)) : "—"}</dd></div>
                </dl>
                {s.revenue > 0 && <p className="text-xs text-sand">Ventes livrées : <strong className="text-ivory">{da(s.revenue)}</strong></p>}
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-4 text-xs text-stone">
          Classement par commandes puis par visites. Le réseau en tête est celui où vos publications rapportent le plus : c&apos;est là qu&apos;un boost (publicité sponsorisée) a le plus de chances d&apos;être rentable. Vos propres visites en tant qu&apos;administrateur ne sont pas comptées.
        </p>
      </Panel>

      {t.visits === 0 && r.sources.length === 0 ? (
        <Empty>
          Aucune visite enregistrée sur cette période. Les visites sont comptées dès maintenant ; partagez vos liens suivis (en bas de page) sur vos réseaux pour voir les premiers chiffres.
        </Empty>
      ) : (
        <div className="flex flex-col gap-6">
          {notes.length > 0 && (
            <section className="flex flex-col gap-2 rounded-panel border border-gold/30 bg-gradient-to-br from-gold/10 to-transparent p-5">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-gold">
                <Lightbulb className="size-4" aria-hidden /> À retenir
              </h2>
              <ul className="flex flex-col gap-1.5 text-sm text-sand">
                {notes.map((n) => (
                  <li key={n}>• {n}</li>
                ))}
              </ul>
            </section>
          )}

          <Panel title="D'où viennent vos visiteurs">
            <div className="mb-6 flex h-3 w-full overflow-hidden rounded-full bg-umber-800" role="img" aria-label="Répartition des visites par source">
              {r.sources
                .filter((s) => s.visits > 0)
                .map((s) => (
                  <span key={s.source} style={{ width: `${pct(s.visits, t.visits)}%`, background: sourceInfo(s.source).color }} title={`${sourceInfo(s.source).label} — ${fmtPct(pct(s.visits, t.visits))}`} />
                ))}
            </div>
            <Table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th className="text-end">Visites</th>
                  <th className="text-end">Visiteurs</th>
                  <th className="text-end">Comptes</th>
                  <th className="text-end">Commandes</th>
                  <th className="text-end">Conversion</th>
                  <th className="text-end">Montant commandé</th>
                  <th className="text-end">Ventes livrées</th>
                </tr>
              </thead>
              <tbody>
                {r.sources.map((s) => (
                  <tr key={s.source}>
                    <td className="min-w-44">
                      <span className="flex items-center gap-2 font-semibold">
                        <Dot source={s.source} />
                        {s.source === "unknown" ? "Non mesurée" : sourceInfo(s.source).label}
                      </span>
                      {s.visits > 0 && <span className="block ps-[18px] text-xs text-stone">{fmtPct(pct(s.visits, t.visits))} des visites</span>}
                      {s.source === "unknown" && <span className="block ps-[18px] text-xs text-stone">avant la mise en place du suivi</span>}
                    </td>
                    <td className="text-end tabular-nums">{s.visits || "—"}</td>
                    <td className="text-end tabular-nums">{s.visitors || "—"}</td>
                    <td className="text-end tabular-nums">{s.signups || "—"}</td>
                    <td className="text-end tabular-nums">{s.orders || "—"}</td>
                    <td className="text-end tabular-nums">{s.visitors ? fmtPct(pct(s.orders, s.visitors)) : "—"}</td>
                    <td className="text-end tabular-nums">{s.ordersValue ? da(s.ordersValue) : "—"}</td>
                    <td className="text-end tabular-nums">{s.revenue ? da(s.revenue) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="mt-3 text-xs text-stone">
              Une commande ou un compte est attribué à la dernière source (hors accès direct) par laquelle le client est arrivé, dans les 30 jours. Les visites des administrateurs et des robots ne sont pas comptées.
            </p>
          </Panel>

          <Panel title="Visites par jour">
            <div className="flex h-48 items-end gap-[2px]" role="img" aria-label="Visites par jour et par source">
              {r.daily.map((d) => {
                const total = Object.values(d.bySource).reduce((a, b) => a + b, 0);
                return (
                  <div key={d.day} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${new Date(d.day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} — ${total} visite(s)`}>
                    <div className="flex flex-col-reverse overflow-hidden rounded-t-sm" style={{ height: `${(total / maxDay) * 100}%` }}>
                      {chartSources.map((src) =>
                        d.bySource[src] ? <span key={src} style={{ height: `${pct(d.bySource[src], total)}%`, background: sourceInfo(src).color }} /> : null,
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-stone tabular-nums">
              <span>{new Date(r.daily[0].day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
              <span>max. {maxDay} / jour</span>
              <span>{new Date(r.daily.at(-1)!.day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-sand">
              {chartSources.map((src) => (
                <li key={src} className="flex items-center gap-1.5">
                  <Dot source={src} /> {sourceInfo(src).label}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Campagnes (liens suivis)">
            {r.campaigns.length ? (
              <Table>
                <thead>
                  <tr>
                    <th>Campagne</th>
                    <th>Source</th>
                    <th className="text-end">Visites</th>
                    <th className="text-end">Visiteurs</th>
                    <th className="text-end">Commandes</th>
                    <th className="text-end">Montant commandé</th>
                  </tr>
                </thead>
                <tbody>
                  {r.campaigns.map((c) => (
                    <tr key={`${c.source}|${c.campaign}`}>
                      <td className="font-semibold">{c.campaign}</td>
                      <td>
                        <span className="flex items-center gap-2">
                          <Dot source={c.source} /> {sourceInfo(c.source).label}
                          {c.medium && <span className="text-xs text-stone">· {c.medium}</span>}
                        </span>
                      </td>
                      <td className="text-end tabular-nums">{c.visits}</td>
                      <td className="text-end tabular-nums">{c.visitors}</td>
                      <td className="text-end tabular-nums">{c.orders || "—"}</td>
                      <td className="text-end tabular-nums">{c.ordersValue ? da(c.ordersValue) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="text-sm text-sand">Aucune campagne sur cette période. Créez un lien suivi ci-dessous pour chaque publication ou publicité.</p>
            )}
          </Panel>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Pages d'arrivée">
              {r.pages.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {r.pages.map((p) => (
                    <li key={p.path} className="flex items-center justify-between gap-3">
                      <span dir="ltr" className="truncate text-sand">{p.path}</span>
                      <span className="tabular-nums">{p.visits}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-sand">—</p>
              )}
            </Panel>
            <Panel title="Appareils">
              {r.devices.length ? (
                <ul className="flex flex-col gap-3 text-sm">
                  {r.devices.map((d) => {
                    const info = DEVICES[d.device] ?? { label: d.device, icon: Monitor };
                    return (
                      <li key={d.device} className="flex flex-col gap-1.5">
                        <span className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-sand"><info.icon className="size-4" aria-hidden /> {info.label}</span>
                          <span className="tabular-nums">{fmtPct(pct(d.visits, t.visits))}</span>
                        </span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-umber-800">
                          <span className="block h-full rounded-full bg-gold" style={{ width: `${pct(d.visits, t.visits)}%` }} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-sand">—</p>
              )}
            </Panel>
            <Panel title="Ce que disent les clients">
              <p className="mb-3 text-xs text-stone">Réponse à « Comment avez-vous connu Boulboul ? » à la création du compte — tous les clients depuis le début.</p>
              {r.declared.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {r.declared.map((d) => (
                    <li key={d.source} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sand"><Dot source={d.source.toLowerCase()} /> {DECLARED[d.source] ?? d.source}</span>
                      <span className="tabular-nums">{d.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-sand">Aucune réponse pour le moment.</p>
              )}
            </Panel>
          </div>
        </div>
      )}

      <Panel title="Créer un lien suivi" className="mt-6">
        <CampaignLinkBuilder
          baseUrl={baseUrl}
          pages={[
            { path: "/", label: "Accueil" },
            { path: "/wall-art", label: "Boutique" },
            { path: "/customize", label: "Sur mesure" },
            { path: "/about", label: "Qui est Boulboul" },
            ...products.map((p) => ({ path: `/wall-art/${p.slug}`, label: `Produit — ${p.name}` })),
          ]}
        />
      </Panel>

      <p className="mt-6 text-xs text-stone">
        Confidentialité : aucune adresse IP ni donnée personnelle n&apos;est enregistrée pour les visites — seulement la source, la page d&apos;arrivée, le type d&apos;appareil et un identifiant aléatoire (cookie du site) pour compter les visiteurs uniques. Les visites de plus de 13 mois sont supprimées automatiquement.
      </p>
    </>
  );
}
