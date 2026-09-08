/// <reference types="vite/client" />

// Los imports de CSS son efectos secundarios del bundler, no modulos con tipos.
declare module '*.css' {
  const contenido: string;
  export default contenido;
}
