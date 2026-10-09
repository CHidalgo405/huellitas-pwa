const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const path = require('path');

const PUERTO = process.env.PORT || 3000;

// Sin llaves VAPID no se pueden enviar notificaciones: avisamos claro y salimos
if (!process.env.VAPID_PUBLIC || !process.env.VAPID_PRIVATE) {
    console.error('Faltan VAPID_PUBLIC y VAPID_PRIVATE en el archivo .env');
    console.error('Genéralas con: npx web-push generate-vapid-keys');
    process.exit(1);
}

const app = express();

app.use(cors());

// Chrome lo pide cuando una página pública (GitHub Pages) llama a localhost
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    next();
});

app.use(express.json());

// Configuración VAPID
webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:tu-correo@ejemplo.com',
    process.env.VAPID_PUBLIC,
    process.env.VAPID_PRIVATE
);

let suscripciones = [];

// Registrar suscripción
app.post('/api/subscribe', (req, res) => {

    const sub = req.body;

    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
        return res.status(400).json({
            error: 'Suscripción inválida'
        });
    }

    const yaExiste = suscripciones.some(
        (s) => s.endpoint === sub.endpoint
    );

    if (!yaExiste) {
        suscripciones.push(sub);
    }

    console.log('Suscripciones:', suscripciones.length);

    res.status(201).json({
        ok: true,
        suscripciones: suscripciones.length
    });
});

// Enviar notificaciones Push a todos los suscritos
app.post('/api/push', async (req, res) => {

    const payload = JSON.stringify({
        title: String(req.body.title || 'Huellitas').slice(0, 60),
        body: String(req.body.body || 'Hay un mensaje nuevo').slice(0, 240)
    });

    console.log('Enviando notificación:', payload);

    let enviadas = 0;
    let errores = 0;

    for (const sub of [...suscripciones]) {
        try {

            const resultado = await webpush.sendNotification(
                sub,
                payload
            );

            console.log(
                'Push aceptado:',
                resultado.statusCode
            );

            enviadas++;

        } catch (err) {

            errores++;

            console.error('Error al enviar Push:');
            console.error('Estado:', err.statusCode);
            console.error('Mensaje:', err.message);
            console.error('Detalles:', err.body);

            // Suscripción vencida o dada de baja: la quitamos
            if (err.statusCode === 404 || err.statusCode === 410) {
                suscripciones = suscripciones.filter(
                    (s) => s.endpoint !== sub.endpoint
                );
            }
        }
    }

    res.json({
        enviadas,
        errores,
        suscripciones: suscripciones.length
    });
});

// Sirve la PWA en http://localhost:3000 (solo la carpeta huellitas, nunca server/)
app.use(express.static(path.join(__dirname, '..', '..', 'huellitas')));

app.listen(PUERTO, () => {
    console.log(`Servidor Activo: http://localhost:${PUERTO}`);
});
