import { store } from "./store/store.js";

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
        // Vaciar cola de mensajes pendientes
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

        // Manejar respuesta de Ticks en tiempo real
        if (data.msg_type === 'tick' && _onRealtimeCallback) {
            const tick = data.tick;
            _onRealtimeCallback({
                time: tick.epoch * 1000,
                close: tick.quote,
                open: tick.quote,
                high: tick.quote,
                low: tick.quote,
                volume: 0
            });
        }

        // Manejar respuesta de Historial de Velas
        if (data.msg_type === 'candles') {
            // Esta parte se gestiona mediante promesas en getHistoryDWS
            window.dispatchEvent(new CustomEvent('deriv_candles', { detail: data.candles }));
        }
    };

    derivWS.onerror = (err) => console.error("❌ Error WS:", err);
    derivWS.onclose = () => {
        console.warn("⚠️ Conexión cerrada. Reintentando en 5s...");
        setTimeout(initDerivWSConnection, 5000);
    };
}

// Envío seguro: si no está conectado, guarda en cola
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
        { symbol: 'R_10', name: 'Volatility 10 Index', description: 'Volatility 10 Index', pricescale: 100 },
        { symbol: 'R_25', name: 'Volatility 25 Index', description: 'Volatility 25 Index', pricescale: 100 },
        { symbol: 'R_50', name: 'Volatility 50 Index', description: 'Volatility 50 Index', pricescale: 100 },
        { symbol: 'R_75', name: 'Volatility 75 Index', description: 'Volatility 75 Index', pricescale: 100 },
        { symbol: 'R_100', name: 'Volatility 100 Index', description: 'Volatility 100 Index', pricescale: 100 }
    ];
}

export function getHistoryDWS(symbol, from, to, resolution) {
    return new Promise((resolve) => {
        const granularity = parseInt(resolution) * 60 || 60; // 1m = 60s
        
        const request = {
            ticks_history: symbol,
            adjust_start_time: 1,
            count: 1000,
            end: "latest",
            style: "candles",
            granularity: granularity
        };

        const handleResponse = (e) => {
            const candles = e.detail.map(c => ({
                time: c.epoch * 1000,
                low: c.low,
                high: c.high,
                open: c.open,
                close: c.close,
                volume: 0
            }));
            window.removeEventListener('deriv_candles', handleResponse);
            resolve(candles);
        };

        window.addEventListener('deriv_candles', handleResponse);
        safeSend(request);
    });
}

export function subscribeOnStream(symbolInfo, resolution, onRealtimeCallback, subscribeUID) {
    _onRealtimeCallback = onRealtimeCallback;
    const request = {
        ticks: symbolInfo.name,
        subscribe: 1
    };
    safeSend(request);
}

export function unsubscribeFromStream(subscriberUID) {
    console.log("Desuscrito de:", subscriberUID);
    if (derivWS && derivWS.readyState === WebSocket.OPEN) {
        derivWS.send(JSON.stringify({ forget_all: "ticks" }));
    }
    _onRealtimeCallback = null;
}