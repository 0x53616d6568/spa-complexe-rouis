/**
 * Complexe Rouis d'esthétique — Liste de prix
 * Source unique de vérité : docs/rouis_price_list.txt
 * Aucun service, prix ou durée inventé.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouisVariant {
  readonly label: string;
  readonly price: number;
  readonly priceFrom?: boolean;
  readonly note?: string;
}

export interface RouisService {
  readonly id: string;
  readonly name: string;
  readonly category: RouisCategory;
  readonly price: number;          // prix principal en dinars
  readonly priceFrom?: boolean;    // true → "À partir de …"
  readonly note?: string;          // ex. "12 séances"
  readonly variants?: readonly RouisVariant[];
  readonly featured?: boolean;
}

export type RouisCategory =
  | 'Ongles'
  | 'Cheveux'
  | 'Cils & Sourcils'
  | 'Soins du visage'
  | 'Maquillage'
  | 'Coiffure & Chignon'
  | 'Épilation'
  | 'Massage'
  | 'Amincissement';

export const ROUIS_CATEGORIES: readonly RouisCategory[] = [
  'Ongles',
  'Cheveux',
  'Cils & Sourcils',
  'Soins du visage',
  'Maquillage',
  'Coiffure & Chignon',
  'Épilation',
  'Massage',
  'Amincissement',
] as const;

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export const ROUIS_SERVICES: readonly RouisService[] = [
  // ── Ongles ──────────────────────────────────────────────────────────────
  {
    id: 'ongles-vernis',
    name: 'Vernis permanent',
    category: 'Ongles',
    price: 20,
    featured: true,
    variants: [
      { label: 'Mains', price: 20 },
      { label: 'Pieds', price: 20 },
      { label: 'Design / French', price: 5 },
    ],
  },
  {
    id: 'ongles-gel',
    name: 'Gel naturel',
    category: 'Ongles',
    price: 35,
  },
  {
    id: 'ongles-capsule',
    name: 'Capsule + Gel + Vernis',
    category: 'Ongles',
    price: 50,
  },
  {
    id: 'ongles-babyboomer',
    name: 'Baby Boomer',
    category: 'Ongles',
    price: 70,
  },
  {
    id: 'ongles-casses',
    name: 'Ongles cassés',
    category: 'Ongles',
    price: 5,
    note: 'par ongle',
  },
  {
    id: 'ongles-soins',
    name: 'Soins des ongles',
    category: 'Ongles',
    price: 30,
    variants: [
      { label: 'Mains', price: 30 },
      { label: 'Pieds', price: 40 },
    ],
  },

  // ── Cheveux ─────────────────────────────────────────────────────────────
  {
    id: 'cheveux-brushing',
    name: 'Brushing',
    category: 'Cheveux',
    price: 10,
    priceFrom: true,
    featured: true,
  },
  {
    id: 'cheveux-coloration',
    name: 'Coloration',
    category: 'Cheveux',
    price: 50,
    priceFrom: true,
    variants: [
      { label: 'Coloration', price: 50, priceFrom: true },
      { label: 'Coloration racine', price: 40 },
      { label: 'Coloration + Mèche', price: 120, priceFrom: true },
    ],
  },
  {
    id: 'cheveux-proteine',
    name: 'Protéine + Kératine',
    category: 'Cheveux',
    price: 150,
    priceFrom: true,
  },
  {
    id: 'cheveux-soins',
    name: 'Soins cheveux',
    category: 'Cheveux',
    price: 150,
    priceFrom: true,
  },

  // ── Cils & Sourcils ─────────────────────────────────────────────────────
  {
    id: 'cils-naturel',
    name: 'Cil à cil',
    category: 'Cils & Sourcils',
    price: 70,
    featured: true,
    variants: [
      { label: 'Naturel', price: 70 },
      { label: 'Glamour', price: 100 },
      { label: 'Bouquet', price: 100 },
    ],
  },
  {
    id: 'cils-lashlift',
    name: 'Lash Lift',
    category: 'Cils & Sourcils',
    price: 40,
  },
  {
    id: 'cils-browlift',
    name: 'Brow Lift',
    category: 'Cils & Sourcils',
    price: 40,
  },

  // ── Soins du visage ─────────────────────────────────────────────────────
  {
    id: 'soin-visage',
    name: 'Soin du visage',
    category: 'Soins du visage',
    price: 50,
    priceFrom: true,
    featured: true,
    variants: [
      { label: 'Basique', price: 50 },
      { label: 'Spécifique', price: 90 },
      { label: 'Hydrafacial', price: 200 },
      { label: 'Oxygeneo', price: 250 },
      { label: 'Micro Needling', price: 300 },
      { label: 'Mésothérapie', price: 150 },
      { label: 'Fil collagène', price: 180 },
    ],
  },

  // ── Maquillage ──────────────────────────────────────────────────────────
  {
    id: 'maquillage',
    name: 'Maquillage',
    category: 'Maquillage',
    price: 80,
    priceFrom: true,
    featured: true,
    variants: [
      { label: 'Invitée simple', price: 80 },
      { label: 'Invitée soirée', price: 100 },
      { label: 'Fiançailles ou Zdek', price: 250 },
      { label: 'Mariée, hijeb ou chignon inclus', price: 600 },
    ],
  },

  // ── Coiffure & Chignon ──────────────────────────────────────────────────
  {
    id: 'chignon',
    name: 'Chignon',
    category: 'Coiffure & Chignon',
    price: 30,
    priceFrom: true,
    variants: [
      { label: 'Tresser enfant', price: 30, priceFrom: true },
      { label: 'Wavy', price: 40, priceFrom: true },
      { label: 'Bien coiffée', price: 50, priceFrom: true },
    ],
  },

  // ── Épilation ───────────────────────────────────────────────────────────
  {
    id: 'epilation-cire',
    name: 'Épilation à la cire',
    category: 'Épilation',
    price: 10,
    priceFrom: true,
    featured: true,
    variants: [
      { label: 'Corps complet', price: 100 },
      { label: 'Jambe', price: 30 },
      { label: 'Bras', price: 25 },
      { label: 'Aisselles', price: 10 },
    ],
  },
  {
    id: 'epilation-sucre',
    name: 'Épilation au sucre traditionnelle',
    category: 'Épilation',
    price: 20,
    priceFrom: true,
    variants: [
      { label: 'Jambe', price: 25 },
      { label: 'Bras', price: 20 },
    ],
  },
  {
    id: 'epilation-visage',
    name: 'Épilation visage',
    category: 'Épilation',
    price: 25,
  },
  {
    id: 'epilation-sourcils',
    name: 'Sourcils + Moustache',
    category: 'Épilation',
    price: 14,
    note: '10 dt + 4 dt',
  },
  {
    id: 'epilation-tracage',
    name: 'Traçage sourcils',
    category: 'Épilation',
    price: 10,
  },
  {
    id: 'hammam',
    name: 'Hammam',
    category: 'Épilation',
    price: 20,
    variants: [
      { label: 'Hammam', price: 20 },
      { label: 'Hammam + Hârza', price: 25 },
    ],
  },

  // ── Massage ─────────────────────────────────────────────────────────────
  {
    id: 'massage',
    name: 'Massage',
    category: 'Massage',
    price: 25,
    priceFrom: true,
    featured: true,
    variants: [
      { label: 'Relaxant — Corps complet', price: 45 },
      { label: 'Dos + Nuque', price: 25 },
      { label: 'Jambes', price: 25 },
      { label: 'Visage + Tête', price: 25 },
      { label: 'Ventre', price: 80 },
      { label: 'Cuisse', price: 100 },
    ],
  },

  // ── Amincissement ───────────────────────────────────────────────────────
  {
    id: 'amincissement-seances',
    name: 'Amincissement',
    category: 'Amincissement',
    price: 300,
    note: '12 séances',
  },
  {
    id: 'amincissement-platre',
    name: 'Amincissement au plâtre',
    category: 'Amincissement',
    price: 80,
    note: 'par séance',
  },
] as const;

// ---------------------------------------------------------------------------
// Price formatting helper — single source for the whole app
// ---------------------------------------------------------------------------

export function formatPriceDT(amount: number, priceFrom?: boolean): string {
  if (priceFrom) return `À partir de ${amount} dt`;
  return `${amount} dt`;
}

/**
 * Format a price stored in the database (cents, with currency code).
 * Falls back to the dt helper when currency is TND or unknown.
 */
export function formatMoneyDT(amountCents: number, currency: string): string {
  if (currency === 'TND' || currency === 'DT') {
    return `${(amountCents / 100).toFixed(0)} dt`;
  }
  // Legacy fallback for any other currency (shouldn't happen)
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}
