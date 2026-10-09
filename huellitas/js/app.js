// ===== Configuración =====

// Servidor de notificaciones (carpeta server/).
// Si lo despliegas en otro lugar (Render, Railway...), cambia esta URL.
const API_URL = 'http://localhost:3000';

// Llave pública VAPID: la misma que VAPID_PUBLIC en server/.env. Nunca pongas aquí la privada.
const VAPID_PUBLIC_KEY = 'BNRAGHBZHLR4BkI7APjcnYqC2Vv2pW5oOYSc1PVbKcxHLTVkVda-9f1JC5uOnANjBuBTSl3T6r_Oxowy3MwULns';

const PERSONAJES = ['michi', 'bruno', 'canela', 'bambu', 'nube'];
const CLAVE_MENSAJES = 'huellitas:mensajes';
const MAX_MENSAJES = 50;

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

// Referencias de jQuery

var titulo = $('#titulo-texto');
var nuevoBtn = $('#nuevo-btn');
var salirBtn = $('#salir-btn');
var cancelarBtn = $('#cancel-btn');
var postBtn = $('#post-btn');
var avatarSel = $('#seleccion');
var timeline = $('#timeline');

var modal = $('#modal');
var modalAvatar = $('#modal-avatar');
var avatarBtns = $('.seleccion-avatar');
var txtMensaje = $('#txtMensaje');
var contador = $('#contador');
var notifBtn = $('#notif-btn');
var notifTexto = $('#notif-texto');
var estado = $('#estado');
var aviso = $('#aviso');

// El usuario, contiene el ID de la mascota seleccionada
var usuario;

var temporizadorModal;
var temporizadorAviso;


// ===== Mensajes guardados en el dispositivo (así también se ven sin red) =====

function mensajesIniciales() {
    var ahora = Date.now();
    var minuto = 60 * 1000;

    return [
        { autor: 'nube', texto: 'Encontré una zanahoria en el refri. Procedo a investigar.', hora: ahora - 42 * minuto },
        { autor: 'michi', texto: 'Hoy me tocó el mejor rayo de sol de la sala. No se aceptan reservaciones.', hora: ahora - 27 * minuto },
        { autor: 'bruno', texto: '¡Escuché la correa! ¿Alguien más va al parque a las 5?', hora: ahora - 8 * minuto }
    ];
}

function leerMensajes() {
    try {
        var guardados = JSON.parse(localStorage.getItem(CLAVE_MENSAJES));

        if (Array.isArray(guardados)) {
            return guardados.filter(function (m) {
                return m && PERSONAJES.indexOf(m.autor) !== -1 &&
                    typeof m.texto === 'string' && typeof m.hora === 'number';
            });
        }
    } catch (e) { /* sin almacenamiento disponible */ }

    return null;
}

function guardarMensajes() {
    try {
        localStorage.setItem(CLAVE_MENSAJES, JSON.stringify(mensajes.slice(-MAX_MENSAJES)));
    } catch (e) { /* sin almacenamiento disponible */ }
}

var mensajes = leerMensajes() || mensajesIniciales();
guardarMensajes();


// ===== Código de la aplicación =====

function formatearHora(marca) {
    return new Date(marca).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
}

function crearMensajeHTML(msg) {

    var li = $('<li class="mensaje"></li>').toggleClass('propio', msg.autor === usuario);

    $('<img class="avatar" alt="">')
        .attr('src', 'img/avatars/' + msg.autor + '.svg')
        .appendTo(li);

    var burbuja = $('<div class="burbuja"></div>').appendTo(li);
    var meta = $('<div class="meta"></div>').appendTo(burbuja);

    $('<span class="autor"></span>').text('@' + msg.autor).appendTo(meta);
    $('<time class="hora"></time>')
        .attr('datetime', new Date(msg.hora).toISOString())
        .text(formatearHora(msg.hora))
        .appendTo(meta);

    // .text() evita que un mensaje pueda inyectar HTML
    $('<p class="texto"></p>').text(msg.texto).appendTo(burbuja);

    return li;
}

// Pinta todo el muro (el mensaje más nuevo arriba)
function pintarMuro() {
    timeline.empty();

    mensajes.slice(-MAX_MENSAJES).forEach(function (msg) {
        timeline.prepend(crearMensajeHTML(msg));
    });
}

function agregarMensaje(msg) {
    mensajes.push(msg);
    guardarMensajes();
    timeline.prepend(crearMensajeHTML(msg));
}

function mostrarAviso(texto) {
    aviso.text(texto).addClass('visible');

    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(function () {
        aviso.removeClass('visible');
    }, 5000);
}


// Globals
function logIn(ingreso) {

    if (ingreso) {
        nuevoBtn.removeClass('oculto');
        salirBtn.removeClass('oculto');
        timeline.removeClass('oculto');
        avatarSel.addClass('oculto');
        notifBtn.removeClass('oculto');
        modalAvatar.attr('src', 'img/avatars/' + usuario + '.svg');
        pintarMuro();
    } else {
        nuevoBtn.addClass('oculto');
        salirBtn.addClass('oculto');
        timeline.addClass('oculto');
        avatarSel.removeClass('oculto');
        notifBtn.addClass('oculto');
        titulo.text('Huellitas');
        window.scrollTo(0, 0);
    }

}


// Selección de mascota
avatarBtns.on('click', function () {

    usuario = $(this).data('user');

    titulo.text('@' + usuario);

    logIn(true);

});

// Botón de salir
salirBtn.on('click', function () {

    logIn(false);

});


// ===== Hoja para escribir un mensaje =====

function actualizarContador() {
    contador.text(txtMensaje.attr('maxlength') - txtMensaje.val().length);
}

function abrirModal() {
    clearTimeout(temporizadorModal);

    modal.removeClass('oculto');
    modal[0].offsetWidth; // fuerza el reflow para que corra la transición
    modal.addClass('abierta');
    txtMensaje.trigger('focus');
}

function cerrarModal() {
    modal.removeClass('abierta');

    temporizadorModal = setTimeout(function () {
        modal.addClass('oculto');
        txtMensaje.val('');
        actualizarContador();
        nuevoBtn.trigger('focus');
    }, 220);
}

// Botón de nuevo mensaje
nuevoBtn.on('click', abrirModal);

// Botón de cancelar mensaje
cancelarBtn.on('click', cerrarModal);

// Tocar el fondo oscuro o presionar Escape también cierra la hoja
modal.on('click', function (e) {
    if (e.target === modal[0]) cerrarModal();
});

$(document).on('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hasClass('oculto')) cerrarModal();
});

txtMensaje.on('input', actualizarContador);


// ===== Notificaciones =====

// Muestra una notificación en este dispositivo (sin pasar por el servidor).
// El "tag" es el mismo que usa sw.js para los push: si también llega el push
// del servidor, reemplaza a esta en lugar de duplicarla.
async function notificarLocal(tituloNotif, cuerpo) {

    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (Notification.permission !== 'granted') return;

    try {
        var registro = await navigator.serviceWorker.ready;

        await registro.showNotification(tituloNotif, {
            body: cuerpo,
            tag: tituloNotif + '|' + cuerpo,
            icon: 'img/icons/icon-192x192.png',
            badge: 'img/icons/badge-96x96.png'
        });
    } catch (err) {
        console.warn('No se pudo mostrar la notificación:', err);
    }
}

// Pide al servidor que mande el push a todas las mascotas suscritas
async function enviarPush(tituloNotif, cuerpo) {

    // Sin red ni lo intentamos
    if (!navigator.onLine) {
        mostrarAviso('Sin conexión: tu mensaje se guardó aquí, pero no llegó a los demás.');
        return;
    }

    try {
        var respuesta = await fetch(API_URL + '/api/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: tituloNotif, body: cuerpo })
        });

        if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);

    } catch (err) {
        console.warn('No se pudo enviar el push:', err);

        mostrarAviso('No se pudo contactar al servidor de avisos. Revisa que esté encendido.');
    }
}

async function enviarSuscripcion(sub) {
    var respuesta = await fetch(API_URL + '/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
    });

    if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
}

function marcarAvisos(activos) {
    notifBtn.attr('aria-pressed', activos ? 'true' : 'false');
}

function navegadorAdmitePush() {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

// Botón de enviar mensaje
postBtn.on('click', function () {

    var mensaje = txtMensaje.val().trim();
    if (mensaje.length === 0) {
        cerrarModal();
        return;
    }

    agregarMensaje({ autor: usuario, texto: mensaje, hora: Date.now() });
    cerrarModal();

    // Siempre avisa en este dispositivo; el servidor reparte el push a los demás
    notificarLocal('@' + usuario, mensaje);
    enviarPush('@' + usuario, mensaje);
});

// Botón de avisos (alarma)
notifBtn.on('click', async function () {

    if (!navegadorAdmitePush()) {
        mostrarAviso('Este navegador no admite notificaciones. En iPhone, primero agrega la app a la pantalla de inicio.');
        return;
    }

    var permiso = await Notification.requestPermission();

    if (permiso !== 'granted') {
        mostrarAviso('Las notificaciones están bloqueadas. Actívalas desde el candado junto a la dirección.');
        return;
    }

    marcarAvisos(true);

    try {
        var registro = await navigator.serviceWorker.ready;

        // Si ya hay una suscripción (posiblemente vencida), la borramos para obtener una nueva
        var subVieja = await registro.pushManager.getSubscription();
        if (subVieja) await subVieja.unsubscribe();

        var sub = await registro.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        console.log(JSON.stringify(sub));

        await enviarSuscripcion(sub);

        notificarLocal('Avisos activados', 'Te avisaremos cuando alguien de la manada escriba.');

    } catch (err) {
        console.warn('No se pudo completar la suscripción:', err);
        mostrarAviso('No se pudo conectar con el servidor de avisos. Revisa que esté encendido e inténtalo de nuevo.');
    }
});

// Si ya diste permiso antes, vuelve a registrar tu suscripción (el servidor la guarda en memoria)
async function sincronizarSuscripcion() {

    if (!navegadorAdmitePush() || Notification.permission !== 'granted') return;

    marcarAvisos(true);

    // Sin red no hay a quién registrarse; el evento "online" lo reintenta
    if (!navigator.onLine) return;

    try {
        var registro = await navigator.serviceWorker.ready;
        var sub = await registro.pushManager.getSubscription();

        if (sub) await enviarSuscripcion(sub);
    } catch (err) {
        console.log('Suscripción pendiente de sincronizar:', err.message);
    }
}


// ===== Estado de la conexión =====

function actualizarConexion() {
    estado.toggleClass('oculto', navigator.onLine);
}

$(window).on('offline', actualizarConexion);

$(window).on('online', function () {
    actualizarConexion();
    mostrarAviso('De vuelta en línea.');
    sincronizarSuscripcion();
});

actualizarConexion();


// Registro del Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js')
            .catch(function (err) {
                console.log('Error al registrar el SW:', err);
            });

        sincronizarSuscripcion();
    });
}

if (!('Notification' in window) || !('PushManager' in window)) {
    console.log('Este navegador no soporta notificaciones push');
}
