/**
 * Single source of truth for product name and tagline.
 * To rename the product, change the defaults below (or set VITE_BRAND_*).
 * Every UI surface — page titles, nav, metadata — reads from this module.
 */

export const BRAND = {
  name: import.meta.env.VITE_BRAND_NAME ?? 'SpiralFolio',
  tagline: import.meta.env.VITE_BRAND_TAGLINE ?? 'Client Intelligence Platform',
} as const;

export type Brand = typeof BRAND;
