'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { analyze, monthlyPayment } = require('../analyzer');
const C = require('../config');

// Ville inconnue => marché national par défaut (config.FALLBACK_MARKET), donc résultats indépendants des données locales.
const base = { price: 90000, surface: 50, type: 't2', city: 'Ville-Inconnue', dpe: 'D', daysOnline: 0, priceDrops: 0, seller: 'Agence', worksPerM2: 0 };
const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b} (±${eps})`);

test('rendement brut et net (calcul à la main)', () => {
  const a = analyze(base).analysis;
  // coût total = 90 000 + 7,5 % = 96 750 ; loyer = 50 × 12 × 1,05 = 630 €/mois
  near(a.totalCost, 96750, 1);
  near(a.monthlyRent, 630, 1);
  near(a.grossYield, (630 * 12 / 96750) * 100, 0.01);
  // vacance 6 % ; charges = taxe foncière 504 + non récupérable 453,6 = 957,6 ; net = (7560 × 0,94 − 957,6) / 96 750
  near(a.netYield, ((7560 * 0.94 - 957.6) / 96750) * 100, 0.01);
  assert.ok(a.netYield < a.grossYield);
});

test('mensualité de crédit et cash-flow', () => {
  const r = 0.038 / 12, n = 240;
  near(monthlyPayment(100000, 3.8, 20), (100000 * r) / (1 - Math.pow(1 + r, -n)), 0.001); // formule d'annuité, écrite à part
  near(monthlyPayment(100000, 3.8, 20), 595.6, 0.5);                                       // ordre de grandeur connu
  near(monthlyPayment(120000, 0, 10), 1000, 0.001); // taux nul
  assert.strictEqual(monthlyPayment(0, 3.8, 20), 0);
  const a = analyze(base, { apport: 10, rate: 3.8, years: 20 }).analysis;
  near(a.capital, 96750 * 0.9, 1);
  near(a.monthlyCashflow, (7560 * 0.94 - 957.6) / 12 - a.payment, 1.5); // sorties arrondies à l'euro
});

test('frais de notaire réduits dans le neuf', () => {
  near(analyze({ ...base, neuf: true }).analysis.notary, 2250, 1);
});

test('gestion locative et travaux dégradent le rendement', () => {
  const ref = analyze(base).analysis.netYield;
  assert.ok(analyze(base, { gestion: true }).analysis.netYield < ref);
  assert.ok(analyze({ ...base, worksPerM2: 800 }).analysis.netYield < ref);
});

test('cas limites : prix nul, surface nulle, valeurs absentes', () => {
  for (const bad of [{ price: 0 }, { surface: 0 }, { price: undefined }, { surface: NaN }, { price: -5 }]) {
    const a = analyze({ ...base, ...bad }).analysis;
    assert.strictEqual(a.valid, false);
    assert.strictEqual(a.score, 0);
    assert.strictEqual(a.verdict, 'Données insuffisantes');
    assert.ok(Number.isFinite(a.netYield) && Number.isFinite(a.monthlyCashflow));
  }
});

test('DPE inconnu : pas de pénalité, mais signalé', () => {
  const unknown = analyze({ ...base, dpe: 'N/D' }).analysis;
  const d = analyze({ ...base, dpe: 'D' }).analysis;
  assert.strictEqual(unknown.score, d.score);
  assert.ok(unknown.cons.some((c) => /DPE inconnu/.test(c)));
  assert.ok(analyze({ ...base, dpe: undefined }).analysis.cons.some((c) => /DPE inconnu/.test(c)));
});

test('DPE F/G : pénalité sur le score, levier de négociation', () => {
  const d = analyze(base).analysis, g = analyze({ ...base, dpe: 'G' }).analysis;
  assert.ok(g.score < d.score + 12);
  assert.ok(g.negoScore >= d.negoScore + C.NEGO.poorDpe);
  assert.ok(g.negoReasons.some((r) => /DPE G/.test(r)));
});

test('négociation : bornes, étiquettes et offre', () => {
  const easy = analyze({ ...base, price: 300000, daysOnline: 400, priceDrops: 5, seller: 'Succession', dpe: 'G' }).analysis;
  assert.strictEqual(easy.negoLabel, 'Facile');
  assert.ok(easy.negoScore <= 100);
  assert.ok(easy.negoDiscountPct <= C.NEGO.maxDiscountPct);
  assert.ok(easy.offerPrice < 300000 && easy.offerPrice >= 300000 * (1 - C.NEGO.maxDiscountPct / 100) - 500);
  const hard = analyze({ ...base, daysOnline: 2 }).analysis;
  assert.strictEqual(hard.negoLabel, 'Difficile');
});

test('score borné 0-100 et verdict cohérent avec les seuils', () => {
  for (const price of [20000, 60000, 90000, 200000, 900000]) {
    const a = analyze({ ...base, price }).analysis;
    assert.ok(a.score >= 0 && a.score <= 100);
    const expected = C.VERDICTS.find(([min]) => a.score >= min)[1];
    assert.strictEqual(a.verdict, expected);
  }
  assert.ok(analyze({ ...base, price: 40000 }).analysis.score > analyze({ ...base, price: 200000 }).analysis.score);
});

test('ville absente de la base : signalé', () => {
  const a = analyze(base).analysis;
  assert.match(a.marketSource, /défaut national/);
  assert.ok(a.cons.some((c) => /absente de la base de marché/.test(c)));
});

test('les poids permettent d\'atteindre 100 (le score est plafonné à 100)', () => {
  const W = C.WEIGHTS;
  const total = W.netYield + W.discount + W.cashflow + W.tension + W.negotiation + W.trend + W.base;
  assert.ok(total >= 100 && total <= 110, 'total ' + total);
  const best = analyze({ ...base, price: 20000, daysOnline: 300, priceDrops: 3, seller: 'Succession', dpe: 'G' }).analysis;
  assert.ok(best.score <= 100);
});
