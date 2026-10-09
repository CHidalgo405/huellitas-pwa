const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// En tu computadora las llaves vienen de server/.env; en Railway, de las variables del servicio.
// Las variables que ya existan en el entorno tienen prioridad sobre las del archivo.
try {
    process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch (error) { /* no hay .env: se usan las variables del entorno */ }

const PUERTO = process.env.PORT || 3000;

// Sin llaves VAPID no se pueden enviar notificaciones: avisamos claro y salimos
if (!process.env.VAPID_PUBLIC || !process.env.VAPID_PRIVATE) {
    console.error('Faltan VAPID_PUBLIC y VAPID_PRIVATE.');
    console.error('En local van en server/.env; en Railway, en la pestaña Variables del servicio.');
    console.error('Genéralas con: npx web-push generate-vapid-keys');
    process.exit(1);
}

// Sitios que pueden llamar a este servidor desde un navegador.
// Con ALLOWED_ORIGINS (separados por coma) puedes agregar más sin tocar el código.
const ORIGENES_PERMITIDOS = [
    'https://chidalgo405.github.io',                   // la PWA publicada en GitHub Pages
    'http://localhost:3000',                           // la PWA servida por este mismo servidor
    'http://127.0.0.1:3000',
    ...(process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean)
];

// Solo aceptamos suscripciones de los servicios de push de los navegadores.
// Si no, cualquiera podría hacer que este servidor llame a direcciones arbitrarias.
const SERVICIOS_PUSH = [
    'fcm.googleapis.com',                // Chrome, Brave, Opera y Android
    'updates.push.services.mozilla.com', // Firefox
    'web.push.apple.com',                // Safari
    'notify.windows.com'                 // Edge en Windows
];

const MAX_SUSCRIPCIONES = 500;

const app = express();

// Detrás del proxy de Railway, así req.ip es la IP real de quien llama
app.set('trust proxy', 1);

// Si la petición viene de una página, tiene que ser de un sitio permitido.
// (Sin Origin son llamadas directas, p. ej. curl: esas las frena el límite de más abajo.)
app.use((req, res, next) => {
    const origen = req.headers.origin;

    if (origen && !ORIGENES_PERMITIDOS.includes(origen)) {
        return res.status(403).json({ error: 'Origen no permitido' });
    }

    next();
});

app.use(cors({ origin: ORIGENES_PERMITIDOS }));
app.use(express.json({ limit: '10kb' }));

// Configuración VAPID
webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:tu-correo@ejemplo.com',
    process.env.VAPID_PUBLIC,
    process.env.VAPID_PRIVATE
);

// Límite sencillo por IP (en memoria) para que nadie llene de avisos a todos los suscritos
const visitas = new Map();

function limitar(maximoPorMinuto) {
    return (req, res, next) => {
        const clave = req.ip + ' ' + req.path;
        const ahora = Date.now();
        const recientes = (visitas.get(clave) || []).filter((t) => ahora - t < 60 * 1000);

        if (recientes.length >= maximoPorMinuto) {
            return res.status(429).json({ error: 'Demasiadas peticiones. Espera un momento.' });
        }

        recientes.push(ahora);
        visitas.set(clave, recientes);
        next();
    };
}

// Limpia el registro de vez en cuando para que no crezca sin fin
setInterval(() => {
    const ahora = Date.now();

    for (const [clave, tiempos] of visitas) {
        if (tiempos.every((t) => ahora - t >= 60 * 1000)) visitas.delete(clave);
    }
}, 5 * 60 * 1000).unref();

function endpointValido(endpoint) {
    try {
        const url = new URL(endpoint);

        return url.protocol === 'https:' && SERVICIOS_PUSH.some(
            (dominio) => url.hostname === dominio || url.hostname.endsWith('.' + dominio)
        );
    } catch (error) {
        return false;
    }
}

let suscripciones = [];

// Para comprobar que el servidor está vivo (Railway, o abrirlo en el navegador)
app.get('/api/salud', (req, res) => {
    res.json({ ok: true });
});

// Registrar suscripción
app.post('/api/subscribe', limitar(60), (req, res) => {

    const sub = req.body;

    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth || !endpointValido(sub.endpoint)) {
        return res.status(400).json({
            error: 'Suscripción inválida'
        });
    }

    const yaExiste = suscripciones.some(
        (s) => s.endpoint === sub.endpoint
    );

    if (!yaExiste) {
        if (suscripciones.length >= MAX_SUSCRIPCIONES) {
            return res.status(503).json({ error: 'Servidor lleno' });
        }

        suscripciones.push({ endpoint: sub.endpoint, keys: sub.keys });
    }

    console.log('Suscripciones:', suscripciones.length);

    res.status(201).json({
        ok: true,
        suscripciones: suscripciones.length
    });
});

// Enviar notificaciones Push a todos los suscritos
app.post('/api/push', limitar(30), async (req, res) => {

    const { title, body } = req.body || {};

    const payload = JSON.stringify({
        title: String(title || 'Huellitas').slice(0, 60),
        body: String(body || 'Hay un mensaje nuevo').slice(0, 240)
    });

    console.log('Enviando notificación:', payload);

    const destinos = [...suscripciones];

    // Si el dispositivo no está disponible, el aviso caduca en una hora en vez de llegar semanas después
    const resultados = await Promise.allSettled(
        destinos.map((sub) => webpush.sendNotification(sub, payload, { TTL: 60 * 60 }))
    );

    let enviadas = 0;
    let errores = 0;

    resultados.forEach((resultado, i) => {

        if (resultado.status === 'fulfilled') {
            console.log('Push aceptado:', resultado.value.statusCode);
            enviadas++;
            return;
        }

        const err = resultado.reason;
        errores++;

        console.error('Error al enviar Push:');
        console.error('Estado:', err.statusCode);
        console.error('Mensaje:', err.message);
        console.error('Detalles:', err.body);

        // Suscripción vencida o dada de baja: la quitamos
        if (err.statusCode === 404 || err.statusCode === 410) {
            suscripciones = suscripciones.filter(
                (s) => s.endpoint !== destinos[i].endpoint
            );
        }
    });

    res.json({
        enviadas,
        errores,
        suscripciones: suscripciones.length
    });
});

// En tu computadora este servidor también sirve la PWA en http://localhost:3000.
// En Railway solo se despliega la carpeta server/, así que no hay PWA que servir.
const CARPETA_APP = path.join(__dirname, '..', '..', 'huellitas');

if (fs.existsSync(CARPETA_APP)) {
    app.use(express.static(CARPETA_APP));
} else {
    app.get('/', (req, res) => {
        res.type('text/plain').send('Servidor de avisos de Huellitas activo.');
    });
}

app.listen(PUERTO, () => {
    console.log(`Servidor Activo en el puerto ${PUERTO}`);
});
