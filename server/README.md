# Servidor de notificaciones de Huellitas

Express + `web-push`. Guarda las suscripciones en memoria y reparte cada mensaje a todas ellas. En tu computadora también sirve la PWA en <http://localhost:3000>.

## En tu computadora

```bash
npm install
npm start
```

Debe imprimir `Servidor Activo en el puerto 3000`. Las llaves se leen de `server/.env`.

## Llaves VAPID

Este proyecto ya trae un `.env` con llaves propias, y `huellitas/js/app.js` tiene la llave pública correspondiente. Si necesitas llaves nuevas:

```bash
npx web-push generate-vapid-keys
```

La terminal mostrará:

```console
Public Key:
BFwOK7Dhf_MedJhH5Ozg...

Private Key:
3esMHuKVyj4XTWnSl5y9...
```

1. Crea o edita `server/.env` y pega las dos llaves (sin comillas ni espacios):

   ```
   VAPID_PUBLIC=aqui_tu_llave_publica
   VAPID_PRIVATE=aqui_tu_llave_privada
   VAPID_SUBJECT=mailto:tu-correo@ejemplo.com
   ```

   Un archivo `.env` guarda datos secretos fuera del código. Así la llave privada no queda escrita dentro de `server.js`. Cambia `VAPID_SUBJECT` por tu correo real.

2. Abre `huellitas/js/app.js` y reemplaza el valor de `VAPID_PUBLIC_KEY` por tu llave **pública** (la misma del `.env`). Nunca pongas la privada ahí.

3. Reinicia el servidor. Si ya habías dado permiso de notificaciones con otras llaves, pulsa **Avisos** otra vez para crear una suscripción nueva.

> `server/.env` no debe subirse a GitHub. El archivo `.env.example` muestra el formato.

## Desplegar en Railway

Para que las notificaciones funcionen desde la página de GitHub Pages, el servidor tiene que estar en internet.

1. Entra a <https://railway.com> e inicia sesión con GitHub.
2. **New Project → Deploy from GitHub repo** y elige `CHidalgo405/huellitas-pwa` (autoriza a Railway a ver el repositorio si lo pide).
3. Abre el servicio → **Settings → Root Directory** y escribe `/server`. Sin esto, Railway ve el `index.html` de la raíz del repositorio y lo trata como un sitio estático.
4. En **Variables → RAW Editor** pega el contenido de `server/.env`. Para copiarlo sin mostrarlo en pantalla:

   ```bash
   pbcopy < server/.env
   ```

   Cambia `VAPID_SUBJECT` por tu correo (`mailto:...`) y guarda. Railway no necesita `PORT`: lo pone solo.
5. Revisa los cambios pendientes y pulsa **Deploy**. En **Deployments → View logs** debe aparecer `Servidor Activo en el puerto ...`.
6. En **Settings → Networking** pulsa **Generate Domain**. Te da una URL como `https://algo.up.railway.app`.
7. Abre `https://algo.up.railway.app/api/salud`: debe responder `{"ok":true}`.
8. Pon esa URL en `API_URL` dentro de `huellitas/js/app.js`, sube el número de `CACHE_NAME` en `huellitas/sw.js` y haz `git push`.

Variable opcional: `ALLOWED_ORIGINS` (sitios separados por coma) para permitir otros dominios además de `https://chidalgo405.github.io`.

Las suscripciones viven en memoria: si Railway reinicia o vuelve a desplegar el servicio, se pierden. La app las registra de nuevo sola al abrirse, siempre que ya hayas dado permiso.

## Rutas

| Método | Ruta | Qué hace |
| --- | --- | --- |
| `GET` | `/api/salud` | Responde `{"ok":true}` si el servidor está vivo |
| `POST` | `/api/subscribe` | Guarda una suscripción push |
| `POST` | `/api/push` | Envía `{ title, body }` a todas las suscripciones |
| `GET` | `/` | En tu computadora, sirve la carpeta `huellitas/` |

## Protecciones

Como el servidor es público, tiene unas defensas básicas:

- Solo responde a páginas de `https://chidalgo405.github.io` y `localhost` (más lo que agregues en `ALLOWED_ORIGINS`).
- Solo acepta suscripciones de los servicios de push de Chrome, Firefox, Safari y Edge. Así nadie puede usarlo para que el servidor llame a otras direcciones.
- Limita a 30 envíos y 60 suscripciones por minuto por IP, y guarda como máximo 500 suscripciones.
- Un aviso que no se puede entregar caduca en una hora.
