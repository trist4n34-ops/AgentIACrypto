'use strict';
/**
 * Données de marché INDICATIVES par ville (ordre de grandeur 2024-2025).
 * pxM2 = prix moyen appartement ancien (€/m²), rentM2 = loyer nu moyen (€/m²/mois),
 * tension = demande locative (0 faible → 1 très forte), trend = évolution prix 12 mois (%).
 * À remplacer par des sources officielles (DVF, observatoires des loyers) pour un usage réel.
 */
const METRO = ['Castelnau-le-Lez', 'Lattes', 'Pérols', 'Juvignac', 'Saint-Jean-de-Védas', 'Mauguio'];
const CITIES = [
  ['Paris', '75', 'Île-de-France', 10500, 31, 0.98, -3.5],
  ['Lyon', '69', 'Auvergne-Rhône-Alpes', 5300, 15.5, 0.9, -1.0],
  ['Marseille', '13', "Provence-Alpes-Côte d'Azur", 3500, 15, 0.85, 1.0],
  ['Toulouse', '31', 'Occitanie', 4000, 13.5, 0.85, 0.5],
  ['Nice', '06', "Provence-Alpes-Côte d'Azur", 5000, 17.5, 0.8, 0.0],
  ['Nantes', '44', 'Pays de la Loire', 3900, 13.5, 0.85, -1.5],
  ['Bordeaux', '33', 'Nouvelle-Aquitaine', 4600, 14.5, 0.85, -2.0],
  ['Lille', '59', 'Hauts-de-France', 3700, 15, 0.9, 0.5],
  ['Strasbourg', '67', 'Grand Est', 3500, 13.5, 0.8, 0.0],
  ['Montpellier', '34', 'Occitanie', 3600, 14, 0.85, -0.5],
  ['Rennes', '35', 'Bretagne', 4000, 14, 0.9, -1.0],
  ['Grenoble', '38', 'Auvergne-Rhône-Alpes', 2900, 12.5, 0.75, -2.0],
  ['Dijon', '21', 'Bourgogne-Franche-Comté', 2800, 12, 0.7, 0.0],
  ['Saint-Étienne', '42', 'Auvergne-Rhône-Alpes', 1100, 8.5, 0.5, 1.0],
  ['Le Havre', '76', 'Normandie', 2100, 11, 0.65, 2.0],
  ['Rouen', '76', 'Normandie', 2900, 12, 0.75, 0.0],
  ['Reims', '51', 'Grand Est', 2700, 11.5, 0.7, 0.0],
  ['Limoges', '87', 'Nouvelle-Aquitaine', 1500, 9, 0.5, 1.5],
  ['Clermont-Ferrand', '63', 'Auvergne-Rhône-Alpes', 2200, 10.5, 0.65, 0.5],
  ['Mulhouse', '68', 'Grand Est', 1500, 10, 0.55, 1.0],
  ['Metz', '57', 'Grand Est', 2000, 10.5, 0.6, 0.5],
  ['Nîmes', '30', 'Occitanie', 2100, 11, 0.6, 0.5],
  ['Perpignan', '66', 'Occitanie', 1700, 10.5, 0.6, 1.5],
  ['Toulon', '83', "Provence-Alpes-Côte d'Azur", 3100, 13, 0.7, 0.5],
  ['Angers', '49', 'Pays de la Loire', 3000, 12, 0.75, -0.5],
  ['Tours', '37', 'Centre-Val de Loire', 3000, 12, 0.75, -0.5],
  ['Brest', '29', 'Bretagne', 2200, 11, 0.65, 1.0],
  ['Poitiers', '86', 'Nouvelle-Aquitaine', 2200, 10.5, 0.65, 0.0],
  ['Besançon', '25', 'Bourgogne-Franche-Comté', 2200, 11, 0.65, 0.0],
  ['Nancy', '54', 'Grand Est', 2400, 11.5, 0.7, 0.0],
  ['Amiens', '80', 'Hauts-de-France', 2300, 11.5, 0.65, 0.5],
  ['Béziers', '34', 'Occitanie', 1700, 10, 0.55, 1.0],
  ['Roubaix', '59', 'Hauts-de-France', 1800, 11.5, 0.7, 1.5],
  ['Bayonne', '64', 'Nouvelle-Aquitaine', 4000, 14.5, 0.8, 0.0],
  ['La Rochelle', '17', 'Nouvelle-Aquitaine', 4600, 14, 0.8, -1.0],
  // Métropole de Montpellier (valeurs indicatives, loyer de Saint-Jean-de-Védas calé sur les alertes réelles)
  ['Castelnau-le-Lez', '34', 'Occitanie', 4100, 14.5, 0.85, 0.0],
  ['Lattes', '34', 'Occitanie', 3900, 14, 0.8, 0.0],
  ['Pérols', '34', 'Occitanie', 3300, 13.5, 0.75, 0.5],
  ['Juvignac', '34', 'Occitanie', 3800, 13.5, 0.8, 0.0],
  ['Saint-Jean-de-Védas', '34', 'Occitanie', 3900, 15.5, 0.85, 0.0],
  ['Mauguio', '34', 'Occitanie', 3500, 13, 0.7, 0.5],
].map(([name, dept, region, pxM2, rentM2, tension, trend]) => ({
  name, dept, region, pxM2, rentM2, tension, trend,
  metro: name === 'Montpellier' || METRO.includes(name),
}));

// Générateur pseudo-aléatoire déterministe (annonces stables entre redémarrages)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TYPES = [
  { key: 'studio', label: 'Studio', surf: [16, 30], rooms: 1, w: 3 },
  { key: 't2', label: 'T2', surf: [32, 48], rooms: 2, w: 5 },
  { key: 't3', label: 'T3', surf: [52, 72], rooms: 3, w: 4 },
  { key: 't4', label: 'T4', surf: [75, 100], rooms: 4, w: 2 },
  { key: 'maison', label: 'Maison', surf: [85, 160], rooms: 5, w: 3 },
  { key: 'immeuble', label: 'Immeuble de rapport', surf: [180, 380], rooms: 0, w: 2 },
];
const SELLERS = ['Particulier', 'Agence', 'Agence', 'Agence', 'Succession', 'Notaire (vente interactive)', 'Marchand de biens'];
const DPE = ['A', 'B', 'C', 'C', 'D', 'D', 'D', 'E', 'E', 'F', 'G'];
const STREETS = ['rue de la République', 'avenue Jean Jaurès', 'rue Victor Hugo', 'boulevard Gambetta', 'rue Pasteur', 'place du Marché', 'rue des Lilas', 'avenue de la Gare', 'rue Voltaire', 'cours Lafayette'];

function generateListings(n = 220) {
  const rnd = mulberry32(20241104);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const between = (a, b) => a + rnd() * (b - a);
  const bag = TYPES.flatMap((t) => Array(t.w).fill(t));
  const out = [];
  // Montpellier et sa métropole pèsent 3 fois plus dans l'échantillon
  const cityBag = CITIES.flatMap((c) => Array(c.metro ? 3 : 1).fill(c));
  for (let i = 0; i < n; i++) {
    const city = cityBag[Math.floor(rnd() * cityBag.length)];
    const type = pick(bag);
    const surface = Math.round(between(type.surf[0], type.surf[1]));
    const dpe = pick(DPE);
    const seller = pick(SELLERS);
    const worksLevel = rnd() < 0.3 ? Math.round(between(300, 1100)) : 0; // €/m² de travaux
    const typeFactor = type.key === 'maison' ? 0.88 : type.key === 'immeuble' ? 0.78 : type.key === 'studio' ? 1.12 : 1;
    const base = city.pxM2 * typeFactor;
    // écart de prix vs marché : de -25 % (affaire/travaux) à +22 % (survalorisé)
    const gap = between(-0.22, 0.22) - (worksLevel ? 0.08 : 0);
    const askPxM2 = base * (1 + gap);
    const price = Math.round((askPxM2 * surface) / 1000) * 1000;
    const daysOnline = Math.floor(Math.pow(rnd(), 1.6) * 260) + 1;
    const priceDrops = daysOnline > 30 ? Math.min(3, Math.floor(rnd() * (daysOnline / 70 + 1))) : 0;
    const units = type.key === 'immeuble' ? 4 + Math.floor(rnd() * 5) : 1;
    const floor = ['studio', 't2', 't3', 't4'].includes(type.key) ? Math.floor(rnd() * 7) : null;
    out.push({
      id: i + 1,
      city: city.name, dept: city.dept, region: city.region, metro: city.metro,
      address: `${Math.floor(between(1, 80))} ${pick(STREETS)}`,
      type: type.key, typeLabel: type.label,
      surface, rooms: type.rooms, units, floor,
      price, daysOnline, priceDrops,
      dpe, seller, worksPerM2: worksLevel,
      features: [
        rnd() < 0.4 ? 'Balcon' : null, rnd() < 0.3 ? 'Parking' : null,
        rnd() < 0.2 ? 'Ascenseur' : null, rnd() < 0.15 ? 'Cave' : null,
        rnd() < 0.1 ? 'Jardin' : null, worksLevel ? 'Travaux à prévoir' : null,
      ].filter(Boolean),
    });
  }
  return out;
}

module.exports = { CITIES, generateListings };
