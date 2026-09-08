import { AliExpressAdapter } from './adapters/aliexpress/AliExpressAdapter.js';
import { AmazonAdapter } from './adapters/amazon/AmazonAdapter.js';
import { MercadoLibreAdapter } from './adapters/mercadolibre/MercadoLibreAdapter.js';
import type { MarketplaceAdapter } from './MarketplaceAdapter.js';

export const ADAPTERS: readonly MarketplaceAdapter[] = [
  new MercadoLibreAdapter(),
  new AmazonAdapter(),
  new AliExpressAdapter(),
];

/** Adaptador que reconoce esta URL, o null si no es una ficha analizable. */
export const adapterPara = (href: string): MarketplaceAdapter | null => {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  return ADAPTERS.find((a) => a.reconoce(url)) ?? null;
};
