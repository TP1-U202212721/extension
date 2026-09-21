import type { DatosDelVendedor, Insumos } from '../../../domain/insumos.js';
import {
  bloqueDeLaFicha,
  categoria,
  cuantasCalificaciones,
  distintivo,
  nombreDelVendedor,
  promedio,
  publicacionesActivas,
  resenasDelVendedor,
  seguidores,
  textoEmbebido,
} from './relay.js';

/**
 * Insumos de reputacion y resenas para Facebook Marketplace.
 *
 * Se leen del estado embebido, no del DOM (ver `relay.ts`). Sirven tanto para la
 * ficha como para el perfil del vendedor: la ficha publica poco del vendedor y
 * el perfil publica todo, asi que el mismo lector devuelve mas o menos campos
 * segun de que pagina venga. Lo que no esta, no se manda.
 */

/**
 * Lo que la pagina publica del vendedor.
 *
 * Facebook Marketplace no tiene tiendas: el vendedor es una persona. No hay
 * antiguedad en dias, ni ventas completadas, ni porcentaje de valoraciones
 * negativas; esos campos se omiten en vez de rellenarse.
 */
export const datosDelVendedor = (texto: string): DatosDelVendedor | null => {
  const sellerName = nombreDelVendedor(texto);
  if (sellerName === '') return null;

  const estrellas = promedio(texto);
  const cuantas = cuantasCalificaciones(texto);
  const marca = distintivo(texto);

  return {
    sellerName,
    platform: 'Facebook Marketplace',
    ...(estrellas !== undefined && { ratingAverage: estrellas }),
    ...(cuantas !== undefined && { ratingCount: cuantas }),
    ...(marca !== undefined && { isRecognizedSeller: true, badgeLabel: marca }),
  };
};

/** Seguidores y publicaciones activas: solo viven en el perfil del vendedor. */
export interface DatosDelPerfil {
  readonly seguidores?: number;
  readonly publicacionesActivas?: number;
}

export const datosDelPerfil = (texto: string): DatosDelPerfil => {
  const cuantosSeguidores = seguidores(texto);
  const cuantasPublicaciones = publicacionesActivas(texto);
  return {
    ...(cuantosSeguidores !== undefined && { seguidores: cuantosSeguidores }),
    ...(cuantasPublicaciones !== undefined && { publicacionesActivas: cuantasPublicaciones }),
  };
};

/** Id de la publicacion segun la URL abierta. */
const idDeLaFicha = (doc: Document): string =>
  /\/marketplace\/item\/(\d{10,20})/.exec(doc.URL)?.[1] ?? '';

/**
 * El registro de ESTA publicacion. La pagina trae tambien las relacionadas, y
 * leer suelto devolvia los datos de otro anuncio.
 */
const bloqueDeEstaFicha = (doc: Document, texto: string): string => {
  const id = idDeLaFicha(doc);
  return id === '' ? '' : bloqueDeLaFicha(texto, id);
};

export const insumosDe = (doc: Document): Insumos => {
  const texto = textoEmbebido(doc);
  return {
    // El vendedor se lee del texto entero: en el perfil no hay publicacion que acotar.
    vendedor: datosDelVendedor(texto),
    resenas: resenasDelVendedor(texto),
    categoria: categoria(bloqueDeEstaFicha(doc, texto)),
  };
};

export const categoriaGruesaDe = (doc: Document): string => {
  const texto = textoEmbebido(doc);
  return categoria(bloqueDeEstaFicha(doc, texto));
};
