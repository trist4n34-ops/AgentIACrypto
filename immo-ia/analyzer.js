'use strict';
const { CITIES } = require('./data');

const cityIndex = Object.fromEntries(CITIES.map((c) => [c.name, c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

const TYPE_PRICE_FACTOR = { studio: 1.12, t2: 1, t3: 1, t4: 1, maison: 0.88, immeuble: 0.78 };
const TYPE_RENT_FACTOR = { studio: 1.18, t2: 1.05, t3: 1, t4: 0.95, maison: 0.9, immeuble: 0.95 };

function monthlyPayment(capital, annualRate, years) {
  if (capital <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  return r === 0 ? capital / n : (capital * r) / (1 - Math.pow(1 + r, -n));
}

/**
 * Analyse un bien. params : { apport (%), rate (%), years, gestion (bool) }
 */
function analyze(l, params = {}) {
  const { apport = 10, rate = 3.8, years = 20, gestion = false } = params;
  const city = cityIndex[l.city];

  // --- Prix vs marché ---
  const marketPxM2 = city.pxM2 * TYPE_PRICE_FACTOR[l.type];
  const askPxM2 = l.price / l.surface;
  const discount = (marketPxM2 - askPxM2) / marketPxM2; // >0 = moins cher que le marché

  // --- Coût total d'acquisition ---
  const notary = l.price * 0.075;
  const works = l.worksPerM2 * l.surface;
  const totalCost = l.price + notary + works;

  // --- Loyers ---
  const monthlyRent = l.surface * city.rentM2 * TYPE_RENT_FACTOR[l.type];
  const vacancyRate = 0.02 + (1 - city.tension) * 0.1; // 2 % à 12 %
  const taxeFonciere = monthlyRent * (0.6 + (1 - city.tension) * 0.5); // en mois de loyer / an
  const nonRecoverable = monthlyRent * 12 * (l.type === 'immeuble' ? 0.1 : 0.06);
  const gestionCost = gestion ? monthlyRent * 12 * 0.07 : 0;
  const annualRentCollected = monthlyRent * 12 * (1 - vacancyRate);
  const annualCharges = taxeFonciere + nonRecoverable + gestionCost;

  const grossYield = ((monthlyRent * 12) / totalCost) * 100;
  const netYield = ((annualRentCollected - annualCharges) / totalCost) * 100;

  // --- Financement ---
  const capital = Math.max(0, totalCost * (1 - apport / 100));
  const payment = monthlyPayment(capital, rate, years);
  const monthlyCashflow = annualRentCollected / 12 - annualCharges / 12 - payment;

  // --- Négociation ---
  let nego = 0;
  const negoReasons = [];
  const daysPts = clamp(l.daysOnline / 180, 0, 1) * 35;
  nego += daysPts;
  if (l.daysOnline > 90) negoReasons.push(`en ligne depuis ${l.daysOnline} jours`);
  if (l.priceDrops) { nego += l.priceDrops * 9; negoReasons.push(`${l.priceDrops} baisse(s) de prix déjà`); }
  if (discount < 0) { nego += clamp(-discount, 0, 0.2) * 100; negoReasons.push(`affiché ${round(-discount * 100)} % au-dessus du marché`); }
  if (/Succession|Notaire/.test(l.seller)) { nego += 10; negoReasons.push('vendeur pressé (succession / notaire)'); }
  if (['F', 'G'].includes(l.dpe)) { nego += 10; negoReasons.push(`DPE ${l.dpe} : argument de négociation (interdiction de louer à terme)`); }
  nego = clamp(Math.round(nego), 0, 100);
  const negoLabel = nego >= 60 ? 'Facile' : nego >= 35 ? 'Possible' : 'Difficile';
  const negoDiscountPct = round(clamp((nego / 100) * 12, 0, 12), 1);
  const offerPrice = Math.round((l.price * (1 - negoDiscountPct / 100)) / 500) * 500;

  // --- Score d'opportunité (0-100) ---
  const penalty = { E: 3, F: 10, G: 15 }[l.dpe] || 0;
  const score = clamp(Math.round(
    clamp((netYield - 2) / 6, 0, 1) * 38 +            // rendement net
    clamp((discount + 0.1) / 0.3, 0, 1) * 24 +         // décote vs marché
    clamp((monthlyCashflow + 200) / 400, 0, 1) * 14 +  // cash-flow
    city.tension * 12 +                                 // demande locative
    (nego / 100) * 12 +                                 // marge de négociation
    clamp(city.trend / 3, -1, 1) * 2 + 2 - penalty
  ), 0, 100);
  const verdict = score >= 75 ? 'Excellente opportunité' : score >= 60 ? 'Intéressant' : score >= 45 ? 'À négocier' : 'À éviter';

  // --- Commentaire explicatif ---
  const pros = [];
  const cons = [];
  if (discount > 0.05) pros.push(`Prix au m² ${round(discount * 100)} % sous le marché local (${round(askPxM2)} € vs ${round(marketPxM2)} €).`);
  if (discount < -0.05) cons.push(`Prix au m² ${round(-discount * 100)} % au-dessus du marché local.`);
  if (netYield >= 6) pros.push(`Rendement net élevé : ${round(netYield, 1)} %.`);
  else if (netYield < 3.5) cons.push(`Rendement net faible : ${round(netYield, 1)} %.`);
  if (city.tension >= 0.8) pros.push('Forte demande locative dans le secteur.');
  if (city.tension < 0.6) cons.push('Demande locative modérée : risque de vacance plus élevé.');
  if (monthlyCashflow >= 0) pros.push(`Cash-flow positif (${round(monthlyCashflow)} €/mois) avec ce financement.`);
  else cons.push(`Effort d'épargne de ${round(-monthlyCashflow)} €/mois avec ce financement.`);
  if (works) cons.push(`Travaux estimés à ${round(works).toLocaleString('fr-FR')} € (intégrés au calcul).`);
  if (['F', 'G'].includes(l.dpe)) cons.push(`DPE ${l.dpe} : rénovation énergétique à budgéter, location bientôt interdite.`);
  if (city.trend < -1.5) pros.push(`Prix en baisse sur 12 mois (${city.trend} %) : bon moment pour négocier.`);
  if (l.type === 'immeuble') pros.push(`Immeuble de ${l.units} lots : risque de vacance mutualisé.`);

  return {
    ...l,
    analysis: {
      marketPxM2: round(marketPxM2), askPxM2: round(askPxM2), discountPct: round(discount * 100, 1),
      notary: round(notary), works: round(works), totalCost: round(totalCost),
      monthlyRent: round(monthlyRent), vacancyPct: round(vacancyRate * 100, 1),
      annualCharges: round(annualCharges),
      grossYield: round(grossYield, 2), netYield: round(netYield, 2),
      capital: round(capital), payment: round(payment), monthlyCashflow: round(monthlyCashflow),
      negoScore: nego, negoLabel, negoDiscountPct, offerPrice, negoReasons,
      score, verdict, pros, cons,
    },
  };
}

/** Synthèse par ville : rendement brut moyen indicatif d'un T2 type. */
function sectorStats(listings) {
  return CITIES.map((c) => {
    const items = listings.filter((l) => l.city === c.name);
    const avg = (f) => (items.length ? items.reduce((s, x) => s + f(x), 0) / items.length : null);
    const grossRef = ((c.rentM2 * 12) / (c.pxM2 * 1.075)) * 100;
    return {
      city: c.name, dept: c.dept, region: c.region,
      pxM2: c.pxM2, rentM2: c.rentM2, tension: c.tension, trend: c.trend,
      grossYieldRef: round(grossRef, 2),
      count: items.length,
      avgScore: items.length ? round(avg((x) => x.analysis.score)) : null,
    };
  });
}

module.exports = { analyze, sectorStats };
