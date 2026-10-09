// Sube el número cada vez que cambies cualquier archivo del App Shell
const CACHE_NAME = 'huellitas-v1';

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
            .then((cache) => cache.addAll(APP_SHELL))
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

// Manejo de solicitudes
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

    e.respondWith(
        caches.match(e.request).then((cacheResp) => {

            if (cacheResp) {
                return cacheResp;
            }

            return fetch(e.request).then((netResp) => {

                // Guardar solo respuestas correctas
                if (netResp.ok &&
                    netResp.type !== 'opaque') {

                    const copia = netResp.clone();

                    e.waitUntil(
                        caches.open(CACHE_NAME)
                            .then((cache) =>
                                cache.put(e.request, copia)
                            )
                            .catch(console.error)
                    );
                }

                return netResp;

            }).catch(async () => {

                // Sin red: cualquier página abre la app guardada
                if (e.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }

                return Response.error();
            });
        })
    );
});

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
