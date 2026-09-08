import { indeterminado, type FeatureSet } from '../../../domain/features.js';
import type { MarketplaceAdapter, Publicacion } from '../../MarketplaceAdapter.js';

const PENDIENTE = 'Adaptador de AliExpress aun no implementado.';

/**
 * Andamio. El contrato esta completo y el adaptador esta registrado, pero los
 * selectores todavia no existen: todas las caracteristicas degradan a
 * `indeterminado`, que es exactamente el comportamiento correcto mientras no
 * haya evidencia. Nunca devuelve un valor por defecto.
 *
 * TODO(extraccion): implementar selectores de AliExpress y sus fixtures en
 * tests/fixtures/aliexpress/.
 */
export class AliExpressAdapter implements MarketplaceAdapter {
  readonly plataforma = 'AliExpress';

  reconoce(url: URL): boolean {
    return url.hostname.includes('aliexpress.');
  }

  identificar(url: URL): Publicacion | null {
    return this.reconoce(url) ? { plataforma: this.plataforma, publicacionId: url.pathname } : null;
  }

  anclaBadge(_doc: Document): Element | null {
    return null;
  }

  extraer(_doc: Document): FeatureSet {
    return {
      proteccionDePago: indeterminado(PENDIENTE),
      puntuacionDelProducto: indeterminado(PENDIENTE),
      presenciaDeResenas: indeterminado(PENDIENTE),
      politicasDeGarantia: indeterminado(PENDIENTE),
      volumenDeVentas: indeterminado(PENDIENTE),
      veracidadDeDominio: indeterminado('La resuelve el motor de riesgo.'),
      reputacionDelVendedor: indeterminado('La resuelve el motor de riesgo.'),
      autenticidadDeResenas: indeterminado('La resuelve el motor de riesgo.'),
    };
  }
}
