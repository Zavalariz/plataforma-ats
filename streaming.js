import { store } from "./store/store.js";
export let socket;

const appId = '119907';
let derivWS = null;
const messageQueue = []; 
let _onRealtimeCallback = null;

// --- CONFIGURACIÓN DE CONEXIÓN ---

export function initDerivWSConnection() {
    if (derivWS && (derivWS.readyState === WebSocket.OPEN || derivWS.readyState === WebSocket.CONNECTING)) return;

    derivWS = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`);

    derivWS.onopen = () => {
        console.log("✅ Conectado a Deriv WS");
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

        // Manejar respuesta de Ticks en tiempo real (Suscripción)
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

        // Manejar respuesta de Historial de Velas con Evento Único
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

function safeSend(message) {
    if (derivWS && derivWS.readyState === WebSocket.OPEN) {
        derivWS.send(JSON.stringify(message));
    } else {
        messageQueue.push(message);
    }
}

// --- FUNCIONES PARA DATAFEED ---

export function getSymbols() {
    return [
        { symbol: 'R_10', name: 'R_10', description: 'Volatility 10 Index', pricescale: 100 },
        { symbol: 'R_25', name: 'R_25', description: 'Volatility 25 Index', pricescale: 100 },
        { symbol: 'R_50', name: 'R_50', description: 'Volatility 50 Index', pricescale: 100 },
        { symbol: 'R_75', name: 'R_75', description: 'Volatility 75 Index', pricescale: 100 },
        { symbol: 'R_100', name: 'R_100', description: 'Volatility 100 Index', pricescale: 100 }
    ];
}

export function getHistoryDWS(symbol, from, to, resolution = '1') { // <--- Agregamos = '1'
    return new Promise((resolve) => {
        let symbolName = (typeof symbol === 'string') ? symbol : (symbol?.name || "R_100");
        const symbolID = symbolName.split(':').pop().replace('Index', '').trim();

        // Si resolution llega mal, usamos 60 segundos por defecto
        let granularity = 60; 
        const resStr = String(resolution);
        
        if (resStr === '1') granularity = 60;
        else if (resStr === '5') granularity = 300;
        else if (resStr === '15') granularity = 900;
        else if (resStr === '60') granularity = 3600;
        else if (resStr === 'D') granularity = 86400;
        else granularity = 60; // Fallback

        // Nombre de evento único para evitar colisiones de callbacks
        const eventUniqueId = `deriv_candles_${symbolID}_${Math.random().toString(36).substr(2, 9)}`;

        const request = {
            ticks_history: symbolID,
            adjust_start_time: 1,
            count: 1000,
            end: "latest",
            style: "candles",
            granularity: granularity,
            passthrough: { event_name: eventUniqueId } // Importante para el onmessage
        };

        const handleResponse = (e) => {
            if (e.detail) {
                const candles = e.detail.map(c => ({
                    time: parseInt(c.epoch) * 1000, // Forzado a entero y milisegundos
                    low: parseFloat(c.low),
                    high: parseFloat(c.high),
                    open: parseFloat(c.open),
                    close: parseFloat(c.close),
                    volume: 0
                }));
                
                // Ordenar cronológicamente
                candles.sort((a, b) => a.time - b.time);
                
                window.removeEventListener(eventUniqueId, handleResponse);
                resolve(candles);
            }
        };

        window.addEventListener(eventUniqueId, handleResponse);
        console.log(`🛰️ Fetching: ${symbolID} | Resolution: ${resolution}`);
        safeSend(request);
    });
}

export function subscribeOnStream(symbolInfo, resolution, onRealtimeCallback, subscribeUID) {
    _onRealtimeCallback = onRealtimeCallback;
    let symbolID = typeof symbolInfo === 'string' ? symbolInfo : symbolInfo.name;
    symbolID = symbolID.split(':').pop().trim();
    
    const request = {
        ticks: symbolID,
        subscribe: 1
    };
    safeSend(request);
}

export function unsubscribeFromStream(subscriberUID) {
    if (derivWS && derivWS.readyState === WebSocket.OPEN) {
        derivWS.send(JSON.stringify({ forget_all: "ticks" }));
    }
    _onRealtimeCallback = null;
}

export function getSocket() {
    return socket;
}