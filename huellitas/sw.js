// Sube el número en cada publicación: así las pestañas que ya están abiertas se actualizan solas
const CACHE_NAME = 'huellitas-v5';

// Tiempo máximo que esperamos a la red antes de usar la copia guardada
const ESPERA_RED_MS = 2000;

const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/libs/jquery.js',
    './js/app.js',
    './img/favicon.ico',
    './img/apple-touch-icon.png',
    './img/icons/icon-72x72.png',
    './img/icons/icon-96x96.png',
    './img/icons/icon-128x128.png',
    './img/icons/icon-144x144.png',
    './img/icons/icon-152x152.png',
    './img/icons/icon-192x192.png',
    './img/icons/icon-384x384.png',
    './img/icons/icon-512x512.png',
    './img/icons/icon-maskable-192x192.png',
    './img/icons/icon-maskable-512x512.png',
    './img/icons/badge-96x96.png',
    './img/avatars/michi.svg',
    './img/avatars/bruno.svg',
    './img/avatars/canela.svg',
    './img/avatars/bambu.svg',
    './img/avatars/nube.svg'
];

// Instalación
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            // cache: 'reload' evita copiar archivos viejos que el navegador aún tenga guardados
            .then((cache) => cache.addAll(
                APP_SHELL.map((ruta) => new Request(ruta, { cache: 'reload' }))
            ))
            .then(() => self.skipWaiting())
    );
});

// Activación
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Manejo de solicitudes: primero la red, así siempre ves la última versión;
// si no hay red o tarda demasiado, la copia guardada, así funciona sin conexión
self.addEventListener('fetch', (e) => {

    const url = new URL(e.request.url);

    // Ignorar solicitudes que no sean HTTP o HTTPS
    if (url.protocol !== 'http:' &&
        url.protocol !== 'https:') {
        return;
    }

    // Procesar únicamente GET (los POST al servidor de avisos pasan directo)
    if (e.request.method !== 'GET') {
        return;
    }

    // Evita un error conocido de Chrome cuando DevTools está abierto
    if (e.request.cache === 'only-if-cached' &&
        e.request.mode !== 'same-origin') {
        return;
    }

    e.respondWith(redPrimero(e));
});

async function redPrimero(e) {

    const peticion = e.request;

    let guardado = Promise.resolve();

    // "no-cache" revalida con el servidor (una consulta corta, casi siempre 304)
    // e ignora la copia que GitHub Pages deja 10 minutos en el caché del navegador
    const intentoRed = fetch(peticion, { cache: 'no-cache' }).then((resp) => {

        // Guardar solo respuestas correctas
        if (resp.ok) {
            const copia = resp.clone();

            guardado = caches.open(CACHE_NAME)
                .then((cache) => cache.put(peticion, copia))
                .catch(console.error);
        }

        return resp;
    });

    // Mantiene vivo el Service Worker hasta que termine la petición y se guarde la copia,
    // incluso si ya respondimos con la copia vieja porque la red iba lenta.
    // Debe registrarse desde el inicio: llamarlo después de responder no funciona.
    e.waitUntil(intentoRed.then(() => guardado, () => { }));

    const respuesta = await Promise.race([
        intentoRed.catch(() => null),
        new Promise((resolver) => setTimeout(() => resolver(null), ESPERA_RED_MS))
    ]);

    if (respuesta && respuesta.ok) {
        return respuesta;
    }

    // Sin red, red lenta o error del servidor: usamos la copia guardada
    const guardada = await caches.match(peticion, { ignoreSearch: true })
        // Sin red: cualquier página abre la app guardada
        || (peticion.mode === 'navigate' ? await caches.match('./index.html') : undefined);

    if (guardada) {
        return guardada;
    }

    // No hay copia: lo que responda la red (o error si tampoco hay red)
    return respuesta || intentoRed.catch(() => Response.error());
}

// Recibir notificaciones Push
self.addEventListener('push', (e) => {

    let datos = {
        title: 'Huellitas',
        body: 'Hay un mensaje nuevo en la manada'
    };

    if (e.data) {
        try {
            datos = { ...datos, ...e.data.json() };
        } catch (error) {
            datos.body = e.data.text();
        }
    }

    const opciones = {
        body: datos.body,
        // Mismo tag que la notificación local de app.js: evita duplicados en el dispositivo que escribió
        tag: datos.title + '|' + datos.body,
        icon: './img/icons/icon-192x192.png',
        badge: './img/icons/badge-96x96.png',
        vibrate: [120, 60, 120]
    };

    e.waitUntil(
        self.registration.showNotification(
            datos.title,
            opciones
        )
    );
});

// Al tocar la notificación: abrir la app (o enfocarla si ya está abierta)
self.addEventListener('notificationclick', (e) => {

    e.notification.close();

    e.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((ventanas) => {

                const abierta = ventanas.find(
                    (v) => v.url.startsWith(self.registration.scope)
                );

                if (abierta) {
                    return abierta.focus();
                }

                return self.clients.openWindow(self.registration.scope);
            })
    );
});
