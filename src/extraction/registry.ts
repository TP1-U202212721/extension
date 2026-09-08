import { AliExpressAdapter } from './adapters/aliexpress/AliExpressAdapter.js';
import { AmazonAdapter } from './adapters/amazon/AmazonAdapter.js';
import { EbayAdapter } from './adapters/ebay/EbayAdapter.js';
import { MercadoLibreAdapter } from './adapters/mercadolibre/MercadoLibreAdapter.js';
import type { MarketplaceAdapter } from './MarketplaceAdapter.js';

export const ADAPTERS: readonly MarketplaceAdapter[] = [
  new MercadoLibreAdapter(),
  new AmazonAdapter(),
  new AliExpressAdapter(),
  new EbayAdapter(),
];

/**
 * Adaptador de la plataforma a la que pertenece la URL, sea ficha o listado.
 * Que sea o no una ficha analizable lo decide despues `identificar`.
 */
export const adapterPara = (href: string): MarketplaceAdapter | null => {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  return ADAPTERS.find((a) => a.esPlataforma(url)) ?? null;
};
