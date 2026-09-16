import { describe, expect, it } from 'vitest';
import { TOPE, topeDe, topesAplicados } from '../../src/domain/analitica/topes.js';

/**
 * Las frases son LAS DEL BACKEND, copiadas de `DomainVeracityScorer.HardCaps`,
 * `SellerReputationScorer.HardCaps` y `ReviewAuthenticityScorer`. Si alla se
 * reescribe una, este test sigue pasando (el fragmento es corto a proposito) o
 * falla aqui, que es donde tiene que fallar, y no en silencio contra un 99.
 */
const FRASES_DEL_BACKEND: readonly [string, number][] = [
  ['El dominio está reportado en listas públicas de bloqueo.', TOPE.dominioEnListaDeBloqueo],
  [
    'El certificado es anterior a la creación del dominio, lo que es imposible.',
    TOPE.certificadoAnteriorAlDominio,
  ],
  ['El certificado no corresponde a la dirección visitada.', TOPE.certificadoNoCorresponde],
  ['El nombre usa caracteres engañosos para imitar una marca.', TOPE.caracteresEnganosos],
  [
    'El nombre del dominio imita por escasos caracteres a una marca conocida.',
    TOPE.typosquatting,
  ],
  ['El subdominio imita una marca que no es la dueña del dominio.', TOPE.marcaEnSubdominio],
  [
    'El nombre combina una marca ajena con un señuelo de credencial o de pago.',
    TOPE.marcaConSenuelo,
  ],
  ['El enlace apunta a la descarga de un ejecutable.', TOPE.descargaDeEjecutable],
  [
    'No se pudo verificar suficiente información del dominio como para afirmar que es legítimo.',
    TOPE.coberturaDeDominioInsuficiente,
  ],
  [
    'Una cuarta parte o más de las valoraciones del vendedor es negativa, sobre una muestra suficiente.',
    TOPE.valoracionesNegativas,
  ],
  ['El vendedor acumula una tasa de reclamos alta.', TOPE.tasaDeReclamosAlta],
  [
    'La cuenta del vendedor se abrió hace menos de un mes: todavía no hay trayectoria que verificar.',
    TOPE.cuentaReciengAbierta,
  ],
  [
    'La publicación no muestra suficiente información del vendedor como para afirmar que su reputación es sólida.',
    TOPE.coberturaDeVendedorInsuficiente,
  ],
  [
    'El clasificador solo evaluó 12 de las 40 reseñas enviadas.',
    TOPE.resenasEvaluadasParcialmente,
  ],
  [
    'Solo se pudo evaluar 2 reseña(s), muy pocas para afirmar que el conjunto es auténtico.',
    TOPE.muestraDeResenasInsuficiente,
  ],
];

describe('topes duros', () => {
  it.each(FRASES_DEL_BACKEND)('reconoce "%s"', (frase, codigo) => {
    expect(topeDe(frase)).toBe(codigo);
  });

  it('las quince frases dan quince codigos distintos', () => {
    const codigos = new Set(FRASES_DEL_BACKEND.map(([, c]) => c));
    expect(codigos.size).toBe(FRASES_DEL_BACKEND.length);
  });

  /**
   * Un codigo desconocido NO se descarta: cae en 99, para que el total de
   * consultas topeadas siga cuadrando aunque la extension vaya por detras del
   * servidor.
   */
  it('lo que no reconoce cae en 99 y no se pierde', () => {
    expect(topeDe('Un tope que el backend agrego la semana pasada.')).toBe(TOPE.sinClasificar);
  });

  it('no se cuenta dos veces el mismo tope aunque lo apliquen dos analizadores', () => {
    const codigos = topesAplicados([
      'El vendedor acumula una tasa de reclamos alta.',
      'El vendedor acumula una tasa de reclamos alta.',
      'El enlace apunta a la descarga de un ejecutable.',
    ]);
    expect(codigos).toEqual([TOPE.tasaDeReclamosAlta, TOPE.descargaDeEjecutable]);
  });

  it('una lista vacia no produce ningun tope', () => {
    expect(topesAplicados([])).toEqual([]);
    expect(topesAplicados(['  '])).toEqual([]);
  });
});
