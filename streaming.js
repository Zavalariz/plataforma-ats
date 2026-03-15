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
            window.dispatchEvent(new CustomEvent('deriv_candles', { detail: data.candles }));
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

export function getHistoryDWS(symbol, from, to, resolution) {
    return new Promise((resolve) => {
        // Limpiar el símbolo por si viene con texto extra
        const symbolID = symbol.split(':').pop().replace('Index', '').trim();

        // Convertir resolución de TradingView a segundos de Deriv
        let granularity = 60; 
        if (resolution === '1') granularity = 60;
        else if (resolution === '5') granularity = 300;
        else if (resolution === '15') granularity = 900;
        else if (resolution === '60') granularity = 3600;
        else if (resolution === 'D') granularity = 86400;

        const request = {
            ticks_history: symbolID,
            adjust_start_time: 1,
            count: 1000,
            end: "latest",
            style: "candles",
            granularity: granularity
        };

        const handleResponse = (e) => {
            if (e.detail) {
                const candles = e.detail.map(c => ({
                    time: c.epoch * 1000,
                    low: parseFloat(c.low),
                    high: parseFloat(c.high),
                    open: parseFloat(c.open),
                    close: parseFloat(c.close),
                    volume: 0
                }));
                window.removeEventListener('deriv_candles', handleResponse);
                resolve(candles);
            }
        };

        window.addEventListener('deriv_candles', handleResponse);
        console.log(`🛰️ Solicitando: ${symbolID} | Granularidad: ${granularity}s`);
        safeSend(request);
    });
}

export function subscribeOnStream(symbolInfo, resolution, onRealtimeCallback, subscribeUID) {
    _onRealtimeCallback = onRealtimeCallback;
    const symbolID = symbolInfo.name.split(':').pop().trim();
    
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