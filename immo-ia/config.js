'use strict';
/** Paramètres de calcul : tout ce qui pèse sur le score et les rendements est ici, et nulle part ailleurs. */
module.exports = {
  // Frais d'acquisition
  FEES: { notaryOld: 0.075, notaryNew: 0.025 },

  // Hypothèses de charges locatives
  COSTS: {
    vacancyBase: 0.02, vacancySpan: 0.10,      // vacance = base + (1 - tension) * span
    propertyTaxMonths: 0.6, propertyTaxSpan: 0.5, // taxe foncière en mois de loyer = 0.6 + (1 - tension) * 0.5
    nonRecoverable: 0.06, nonRecoverableBuilding: 0.10, // part du loyer annuel
    management: 0.07,
  },

  // Score d'opportunité : points maximum par critère (total 100 avec les bonus)
  WEIGHTS: { netYield: 38, discount: 24, cashflow: 14, tension: 12, negotiation: 12, trend: 2, base: 2 },
  // Bornes de normalisation de chaque critère (valeur basse => 0 point, valeur haute => points maximum)
  RANGES: { netYield: [2, 8], discount: [-0.10, 0.20], cashflow: [-200, 200], trend: [-3, 3] },
  DPE_PENALTY: { E: 3, F: 10, G: 15 },

  // Verdicts : seuils du score
  VERDICTS: [[75, 'Excellente opportunité'], [60, 'Intéressant'], [45, 'À négocier'], [0, 'À éviter']],

  // Négociation
  NEGO: { daysMax: 180, daysPts: 35, perDrop: 9, dropsCap: 3, overpricePts: 100, overpriceCap: 0.2, urgentSeller: 10, poorDpe: 10,
          labels: [[60, 'Facile'], [35, 'Possible'], [0, 'Difficile']], maxDiscountPct: 12 },

  // Marché utilisé quand la ville est inconnue (affiché comme tel)
  FALLBACK_MARKET: { pxM2: 3000, rentM2: 12, tension: 0.6, trend: 0 },

  // Facteurs par type de bien
  TYPE_PRICE_FACTOR: { studio: 1.12, t2: 1, t3: 1, t4: 1, maison: 0.88, immeuble: 0.78 },
  TYPE_RENT_FACTOR: { studio: 1.18, t2: 1.05, t3: 1, t4: 0.95, maison: 0.9, immeuble: 0.95 },

  // Financement par défaut
  DEFAULTS: { apport: 10, rate: 3.8, years: 20, gestion: false },
};
