# Huellitas — Chat de mascotas

Un chat donde cada mascota entra con su placa, escribe en el muro de la manada y avisa a las demás con una notificación. Funciona sin conexión y se instala como una app.

## Propuesta PWA

**Problema.** Los chats para mascotas y familias suelen depender de una app pesada o de una conexión estable. Huellitas es ligera, abre al instante y no se rompe cuando se va el internet.

**Usuarios.** Familias y amigos que comparten el cuidado de sus mascotas y quieren un muro simple para avisarse algo ("ya salió el paseo", "toca la vacuna").

**Por qué una PWA.**

| Necesidad | Cómo la resuelve |
| --- | --- |
| Instalarla sin tienda de apps | `manifest.json` con nombre, colores y 10 íconos (8 normales + 2 *maskable*) |
| Que abra sin red | Service Worker con estrategia *network first* y respaldo en caché sobre el App Shell completo |
| Que se vea completa sin red | Todo es local: sin CDN, sin fuentes externas, íconos de interfaz en SVG dentro del HTML |
| Enterarse de mensajes nuevos | Notificaciones Push (Web Push + VAPID) y notificación local en el dispositivo |
| Poder publicarla gratis | Rutas relativas, funciona en GitHub Pages bajo cualquier subcarpeta |

## Estructura

```
Desempeño-1p/
├── huellitas/            ← la PWA (esto es lo que se publica)
│   ├── index.html
│   ├── manifest.json     ← nombre, colores e íconos
│   ├── sw.js             ← caché offline + notificaciones push
│   ├── css/style.css
│   ├── js/app.js         ← lógica de la app y suscripción push
│   ├── js/libs/jquery.js
│   └── img/
│       ├── favicon.ico
│       ├── apple-touch-icon.png
│       ├── icons/        ← íconos del manifest + badge de notificaciones
│       └── avatars/      ← las 5 mascotas (SVG)
└── server/               ← servidor de notificaciones (Express + web-push)
```

## Cómo funciona cada requisito

### Instalable y con manifest ajustado
`manifest.json` define `id`, `start_url`, `scope`, `display: standalone`, `theme_color` y `background_color`. Los íconos cubren 72 a 512 px con `purpose: "any"`, más dos íconos `maskable` (192 y 512) con el dibujo dentro de la zona segura para que Android no los recorte.

### Modo offline
`sw.js` guarda en el caché (`huellitas-vN`) el App Shell completo (HTML, CSS, JS, jQuery, favicon, íconos y avatares) al instalarse. Después, cada archivo se pide primero a la red; si no hay conexión o el servidor tarda más de 2 segundos, se entrega la copia guardada. Si abres cualquier página sin red, entrega `index.html`.

Los mensajes se guardan en `localStorage`, así que el muro también se ve sin conexión. Si escribes sin red, el mensaje queda en el dispositivo y la app te avisa que no llegó a los demás.

### Notificaciones
- Botón **Avisos**: pide permiso, crea la suscripción push y la manda al servidor.
- Al enviar un mensaje, el servidor reparte el push a todas las suscripciones.
- Al enviar un mensaje también sale siempre una notificación local en este dispositivo, aunque no haya servidor ni red. Si el push del servidor también llega, lo reemplaza (mismo `tag`) en lugar de duplicarse.
- Al tocar una notificación, la app se abre o se enfoca.

## Cómo probarla

1. Arranca el servidor (ver [`../server/README.md`](../server/README.md)) y abre <http://localhost:3000>.
2. Elige una mascota y pulsa **Avisos** para dar permiso.
3. Escribe un mensaje: debe aparecer una notificación.

### Probar el modo offline
1. Abre DevTools (`F12`) → **Application** → **Service Workers**: debe decir *activated and running*.
2. En **Application → Cache Storage** revisa que exista `huellitas-v1` con todos los archivos.
3. Marca **Offline** (en *Service Workers*, o en **Network → No throttling → Offline**) y recarga con `Cmd/Ctrl + R`.
4. La app debe abrir completa: íconos, avatares y mensajes guardados, con el aviso "Sin conexión".
5. Para una prueba más dura, apaga el servidor (`Ctrl + C`) y recarga: sigue abriendo.

### Revisar el manifest
**Application → Manifest** muestra los íconos y debe decir que la app es instalable. También puedes correr **Lighthouse → Progressive Web App**.

## Publicar en GitHub Pages

Todas las rutas son relativas, así que funciona en `https://usuario.github.io/repositorio/` sin cambiar nada. En el repositorio: **Settings → Pages → Deploy from a branch**, y elige la rama y la carpeta que contiene `index.html`.

Dos cosas a tener en cuenta:

- **El servidor no corre en GitHub Pages** (solo sirve archivos estáticos). La app publicada abre y funciona sin red igual, pero para repartir notificaciones push a otras personas necesita el servidor encendido. Por defecto `API_URL` en `js/app.js` apunta a `http://localhost:3000`; si lo despliegas en otro lado (Render, Railway…), cambia esa constante.
- **No subas `server/.env`**: tiene tu llave privada. El `.gitignore` de `Desempeño-1p/` ya lo excluye mientras ese sea el directorio raíz del repositorio.

## Cómo se actualiza

- **Al abrir o recargar la página** ya ves la última versión publicada, sin recargar dos veces: el Service Worker revalida cada archivo con el servidor y no usa la copia que GitHub Pages deja 10 minutos en el caché del navegador.
- **Con la app abierta** busca versiones nuevas cada minuto y al volver a la pestaña. Si encuentra una, se recarga sola; si estás escribiendo un mensaje, espera a que lo cierres para no perderlo.
- **Al publicar**, sube el número de `CACHE_NAME` en `sw.js` (`huellitas-v5`, `v6`…). Eso es lo que avisa a las pestañas ya abiertas de que hay algo nuevo.
- GitHub Pages tarda entre unos segundos y un par de minutos en publicar después de un `push`; eso no se puede acelerar desde la app.
