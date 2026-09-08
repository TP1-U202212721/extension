# ADR 0003 — La autenticacion la delega la extension al cliente web

Estado: aceptado.

## Contexto

La extension necesita un JWT: `POST /InquiryResult/Estimate` y
`POST /DomainAnalysis/Veracity` lo exigen, y `AuthMiddleware` deniega por defecto.

Se probaron dos caminos antes de decidir.

**Formulario propio en el popup.** Se implemento: correo, contrasena y registro
contra `/Auth/sign-in` y `/Auth/sign-up`, replicando las reglas de contrasena del
cliente web. Funcionaba, pero duplicaba una superficie de autenticacion que hay
que mantener sincronizada con la del cliente web cada vez que esta cambie.

**Google con `identity.launchWebAuthFlow`.** Tambien se implemento. El enfoque del
cliente web (Google Identity Services) no es reutilizable: dibuja su boton desde
`https://accounts.google.com/gsi/client`, y la CSP de MV3 prohibe cargar scripts
remotos en las paginas de la extension. El flujo implicito consigue el mismo
`id_token` sin ejecutar codigo de terceros, pero obliga a registrar en Google
Cloud Console una URI de redireccion que **cambia por navegador y por instalacion**:

- Chrome desempaquetado: `https://<id>.chromiumapp.org/`, donde el id se deriva del
  hash de la ruta absoluta de la carpeta.
- Firefox: `https://<uuid>.extensions.allizom.org/`, con un UUID aleatorio **por
  perfil**. Registrarla de antemano es inviable durante el desarrollo.

## Decision

La extension no autentica. Abre `https://scamshield.ryzeon.dev/login` en una
pestana y lee el token que el cliente web deja en la cookie `token`.

Se anaden `permissions: ["cookies"]` y
`host_permissions: ["https://scamshield.ryzeon.dev/*"]`.

## Consecuencias

**A favor**

1. Desaparece el problema de la URI de redireccion. Nada que registrar, identico
   en Chrome, Firefox y Safari.
2. Se heredan sin duplicar nada el inicio con Google, el registro, la recuperacion
   de contrasena y los terminos. Una sola superficie de autenticacion.
3. **La extension nunca ve una contrasena.** Es el mismo comportamiento que la
   extension le predica al comprador cuando le advierte que jamas le pedira
   credenciales dentro de la pagina de un marketplace.
4. Una sola sesion entre la web y la extension, en los dos sentidos: cerrar sesion
   en la web cierra la de la extension.

**En contra**

1. El manifiesto crece. Es una ampliacion real, pero acotada al **dominio propio**
   de ScamShield. Sigue sin haber ni un permiso sobre los marketplaces: la
   restriccion de no emitir peticiones hacia la plataforma del vendedor queda
   intacta.
2. Se depende de que el cliente web este disponible para entrar. Como el backend
   tambien tiene que estarlo para emitir un veredicto, no se pierde nada real.
3. Se depende de **como** el cliente web guarda el token. Hoy usa js-cookie sin
   `httpOnly`, y la API de cookies de la extension lo lee. Si pasara a `httpOnly`
   seguiria funcionando; si pasara a `localStorage`, esto se rompe y habria que
   acordar otro traspaso con el frontend.
4. El cliente web escribe una cookie de **sesion** (sin `expires`), que muere al
   cerrar el navegador. La extension copia el token a `storage.local` para
   sobrevivir a un reinicio hasta que caduque el JWT.
5. En Safari el usuario concede el acceso al sitio a mano la primera vez.
