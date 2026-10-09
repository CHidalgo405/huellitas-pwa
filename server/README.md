# Servidor de notificaciones de Huellitas

Express + `web-push`. Guarda las suscripciones en memoria y reparte cada mensaje a todas ellas. También sirve la PWA en <http://localhost:3000>.

## Puesta en marcha

```bash
npm install
npm start
```

Debe imprimir `Servidor Activo: http://localhost:3000`.

## Llaves VAPID

Este proyecto ya trae un `.env` con llaves propias, y `js/app.js` tiene la llave pública correspondiente. Si necesitas llaves nuevas:

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

## Rutas

| Método | Ruta | Qué hace |
| --- | --- | --- |
| `POST` | `/api/subscribe` | Guarda una suscripción push |
| `POST` | `/api/push` | Envía `{ title, body }` a todas las suscripciones |
| `GET` | `/` | Sirve la carpeta `huellitas/` |

Las suscripciones viven en memoria: al reiniciar el servidor se pierden. La app vuelve a registrarlas sola al abrirse si ya diste permiso.
