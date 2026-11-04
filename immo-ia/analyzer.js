'use strict';
const { CITIES } = require('./data');
const C = require('./config');

const cityIndex = Object.fromEntries(CITIES.map((c) => [c.name, c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
const scale = (v, [lo, hi]) => clamp((v - lo) / (hi - lo), 0, 1);
const pick = (table, v) => table.find(([min]) => v >= min)[1];

function monthlyPayment(capital, annualRate, years) {
  if (!(capital > 0) || !(years > 0)) return 0;
  const r = annualRate / 100 / 12, n = years * 12;
  return r === 0 ? capital / n : (capital * r) / (1 - Math.pow(1 + r, -n));
}

function marketFor(l) {
  const c = cityIndex[l.city];
  if (!c) return { ...C.FALLBACK_MARKET, marketSource: 'défaut national (ville inconnue)', rentSource: 'défaut national (ville inconnue)', known: false };
  return { pxM2: c.pxM2, rentM2: c.rentM2, tension: c.tension, trend: c.trend, marketSource: c.source || 'indicatif', rentSource: c.rentSource || 'indicatif', known: true };
}

const EMPTY = { marketPxM2: 0, askPxM2: 0, discountPct: 0, notary: 0, works: 0, totalCost: 0, monthlyRent: 0, vacancyPct: 0, annualCharges: 0,
  grossYield: 0, netYield: 0, capital: 0, payment: 0, monthlyCashflow: 0, negoScore: 0, negoLabel: 'Difficile', negoDiscountPct: 0, offerPrice: 0, negoReasons: [] };

/** Analyse un bien à vendre. params : { apport (%), rate (%), years, gestion (bool) } */
function analyze(l, params = {}) {
  const { apport, rate, years, gestion } = { ...C.DEFAULTS, ...params };
  const m = marketFor(l);

  if (!(l.price > 0) || !(l.surface > 0)) {
    return { ...l, analysis: { ...EMPTY, valid: false, score: 0, verdict: 'Données insuffisantes', pros: [],
      cons: ['Prix ou surface manquant : analyse impossible.'], marketSource: m.marketSource, rentSource: m.rentSource } };
  }

  // --- Prix vs marché ---
  const marketPxM2 = m.pxM2 * (C.TYPE_PRICE_FACTOR[l.type] ?? 1);
  const askPxM2 = l.price / l.surface;
  const discount = (marketPxM2 - askPxM2) / marketPxM2;

  // --- Coût total d'acquisition ---
  const notary = l.price * (l.neuf ? C.FEES.notaryNew : C.FEES.notaryOld);
  const works = (l.worksPerM2 || 0) * l.surface;
  const totalCost = l.price + notary + works;

  // --- Loyers et charges ---
  const monthlyRent = l.surface * m.rentM2 * (C.TYPE_RENT_FACTOR[l.type] ?? 1);
  const vacancyRate = C.COSTS.vacancyBase + (1 - m.tension) * C.COSTS.vacancySpan;
  const taxeFonciere = monthlyRent * (C.COSTS.propertyTaxMonths + (1 - m.tension) * C.COSTS.propertyTaxSpan);
  const nonRecoverable = monthlyRent * 12 * (l.type === 'immeuble' ? C.COSTS.nonRecoverableBuilding : C.COSTS.nonRecoverable);
  const gestionCost = gestion ? monthlyRent * 12 * C.COSTS.management : 0;
  const annualRentCollected = monthlyRent * 12 * (1 - vacancyRate);
  const annualCharges = taxeFonciere + nonRecoverable + gestionCost;
  const grossYield = ((monthlyRent * 12) / totalCost) * 100;
  const netYield = ((annualRentCollected - annualCharges) / totalCost) * 100;

  // --- Financement ---
  const capital = Math.max(0, totalCost * (1 - clamp(apport, 0, 100) / 100));
  const payment = monthlyPayment(capital, rate, years);
  const monthlyCashflow = annualRentCollected / 12 - annualCharges / 12 - payment;

  // --- Négociation ---
  const N = C.NEGO;
  let nego = 0;
  const negoReasons = [];
  const days = l.daysOnline || 0, drops = l.priceDrops || 0;
  nego += clamp(days / N.daysMax, 0, 1) * N.daysPts;
  if (days > 90) negoReasons.push(`en ligne depuis ${days} jours`);
  if (drops) { nego += Math.min(drops, N.dropsCap) * N.perDrop; negoReasons.push(`${drops} baisse(s) de prix déjà`); }
  if (discount < 0) { nego += clamp(-discount, 0, N.overpriceCap) * N.overpricePts; negoReasons.push(`affiché ${round(-discount * 100)} % au-dessus du marché`); }
  if (/Succession|Notaire/.test(l.seller || '')) { nego += N.urgentSeller; negoReasons.push('vendeur pressé (succession / notaire)'); }
  if (['F', 'G'].includes(l.dpe)) { nego += N.poorDpe; negoReasons.push(`DPE ${l.dpe} : argument de négociation (interdiction de louer à terme)`); }
  nego = clamp(Math.round(nego), 0, 100);
  const negoLabel = pick(N.labels, nego);
  const negoDiscountPct = round(clamp((nego / 100) * N.maxDiscountPct, 0, N.maxDiscountPct), 1);
  const offerPrice = Math.round((l.price * (1 - negoDiscountPct / 100)) / 500) * 500;

  // --- Score d'opportunité (0-100), pondérations dans config.js ---
  const W = C.WEIGHTS, R = C.RANGES;
  const penalty = C.DPE_PENALTY[l.dpe] || 0;
  const score = clamp(Math.round(
    scale(netYield, R.netYield) * W.netYield +
    scale(discount, R.discount) * W.discount +
    scale(monthlyCashflow, R.cashflow) * W.cashflow +
    m.tension * W.tension +
    (nego / 100) * W.negotiation +
    clamp(m.trend / R.trend[1], -1, 1) * W.trend + W.base - penalty
  ), 0, 100);
  const verdict = pick(C.VERDICTS, score);

  // --- Explications ---
  const pros = [], cons = [];
  if (discount > 0.05) pros.push(`Prix au m² ${round(discount * 100)} % sous le marché local (${round(askPxM2)} € vs ${round(marketPxM2)} €).`);
  if (discount < -0.05) cons.push(`Prix au m² ${round(-discount * 100)} % au-dessus du marché local.`);
  if (netYield >= 6) pros.push(`Rendement net élevé : ${round(netYield, 1)} %.`);
  else if (netYield < 3.5) cons.push(`Rendement net faible : ${round(netYield, 1)} %.`);
  if (m.tension >= 0.8) pros.push('Forte demande locative dans le secteur.');
  if (m.tension < 0.6) cons.push('Demande locative modérée : risque de vacance plus élevé.');
  if (monthlyCashflow >= 0) pros.push(`Cash-flow positif (${round(monthlyCashflow)} €/mois) avec ce financement.`);
  else cons.push(`Effort d'épargne de ${round(-monthlyCashflow)} €/mois avec ce financement.`);
  if (works) cons.push(`Travaux estimés à ${round(works).toLocaleString('fr-FR')} € (intégrés au calcul).`);
  if (['F', 'G'].includes(l.dpe)) cons.push(`DPE ${l.dpe} : rénovation énergétique à budgéter, location bientôt interdite.`);
  else if (!'ABCDEFG'.includes(l.dpe || '#') || !l.dpe) cons.push('DPE inconnu : à demander au vendeur avant toute offre.');
  if (m.trend < -1.5) pros.push(`Prix en baisse sur 12 mois (${m.trend} %) : bon moment pour négocier.`);
  if (l.type === 'immeuble') pros.push(`Immeuble de ${l.units || '?'} lots : risque de vacance mutualisé.`);
  if (!m.known) cons.push('Ville absente de la base de marché : valeurs nationales par défaut, résultat peu fiable.');

  return {
    ...l,
    analysis: {
      valid: true,
      marketPxM2: round(marketPxM2), askPxM2: round(askPxM2), discountPct: round(discount * 100, 1),
      notary: round(notary), works: round(works), totalCost: round(totalCost),
      monthlyRent: round(monthlyRent), vacancyPct: round(vacancyRate * 100, 1), annualCharges: round(annualCharges),
      grossYield: round(grossYield, 2), netYield: round(netYield, 2),
      capital: round(capital), payment: round(payment), monthlyCashflow: round(monthlyCashflow),
      negoScore: nego, negoLabel, negoDiscountPct, offerPrice, negoReasons,
      score, verdict, pros, cons, marketSource: m.marketSource, rentSource: m.rentSource,
    },
  };
}

/** Synthèse par ville. */
function sectorStats(listings) {
  return CITIES.map((c) => {
    const items = listings.filter((l) => l.city === c.name && l.analysis.valid);
    const avgScore = items.length ? round(items.reduce((s, x) => s + x.analysis.score, 0) / items.length) : null;
    return {
      city: c.name, dept: c.dept, region: c.region, pxM2: c.pxM2, rentM2: c.rentM2, tension: c.tension, trend: c.trend,
      grossYieldRef: round(((c.rentM2 * 12) / (c.pxM2 * (1 + C.FEES.notaryOld))) * 100, 2),
      count: items.length, avgScore, metro: !!c.metro, marketSource: c.source || 'indicatif', rentSource: c.rentSource || 'indicatif',
    };
  });
}

module.exports = { analyze, sectorStats, monthlyPayment };
