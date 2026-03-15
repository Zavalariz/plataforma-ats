import { store } from "./store/store.js";
export let socket; // Esta será una referencia a derivWS

const appId = '119907';
let derivWS = null;
const messageQueue = []; 
let _onRealtimeCallback = null;

export function initDerivWSConnection() {
    if (derivWS && (derivWS.readyState === WebSocket.OPEN || derivWS.readyState === WebSocket.CONNECTING)) return;

    derivWS = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`);
    socket = derivWS; // Asignamos la referencia para el export

    derivWS.onopen = () => {
        console.log("✅ Conectado a Deriv WS");
        
        // --- NUEVO: AUTORIZACIÓN ---
        const accountData = JSON.parse(localStorage.getItem('selectedAccount'));
        if (accountData && accountData.token) {
            console.log("🔑 Autorizando cuenta...");
            safeSend({ authorize: accountData.token });
        }
        // ---------------------------

        while (messageQueue.length > 0) {
            const msg = messageQueue.shift();
            derivWS.send(JSON.stringify(msg));
        }
    };

    derivWS.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        
        if (data.error) {
            console.error("❌ Error de Deriv:", data.error.message);
            return;
        }

        // --- NUEVO: ENVIAR TODO AL HTML ---
        // Esto permite que el balance y precios de botones funcionen
        window.dispatchEvent(new CustomEvent('deriv_data', { detail: data }));

        // Al autorizar, pedimos el balance inmediatamente
        if (data.msg_type === 'authorize') {
            console.log("✅ Cuenta Autorizada");
            safeSend({ balance: 1, subscribe: 1 });
            // Opcional: Suscribirse a contratos abiertos para la pestaña Trading
            safeSend({ proposal_open_contract: 1, subscribe: 1 });
        }
        // ----------------------------------

        if (data.msg_type === 'tick' && _onRealtimeCallback) {
            const tick = data.tick;
            _onRealtimeCallback({
                time: parseInt(tick.epoch) * 1000,
                close: parseFloat(tick.quote),
                open: parseFloat(tick.quote),
                high: parseFloat(tick.quote),
                low: parseFloat(tick.quote),
                volume: 0
            });
        }

        if (data.msg_type === 'candles') {
            const eventName = data.echo_req.passthrough?.event_name || 'deriv_candles';
            window.dispatchEvent(new CustomEvent(eventName, { detail: data.candles }));
        }
    };

    derivWS.onerror = (err) => console.error("❌ Error WS:", err);
    derivWS.onclose = () => {
        console.warn("⚠️ Conexión cerrada. Reintentando en 5s...");
        setTimeout(initDerivWSConnection, 5000);
    };
}

// ... resto de tus funciones (getSymbols, getHistoryDWS, etc.) ...

export function safeSend(message) {
    if (derivWS && derivWS.readyState === WebSocket.OPEN) {
        derivWS.send(JSON.stringify(message));
    } else {
        messageQueue.push(message);
    }
}

export function getSocket() {
    return derivWS; // Retornamos derivWS que es el socket real
}

// ... mantener tus exports de datafeed abajo ...