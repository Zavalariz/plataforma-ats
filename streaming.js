// streaming.js - Versión compatible con GitHub Pages y JS Puro
import { store } from "./store/store.js";

const appId = 62094;
// Recuperamos la cuenta seleccionada desde el localStorage que guarda tu dashboard
const selectedAccount = JSON.parse(localStorage.getItem("selectedAccount"));
export let derivWS = null;
const connectionDStatus = document.getElementById("connection-indicator");
const subscriptions = new Map();

// Función de inicialización corregida
export function initDerivWSConnection() {
    if (derivWS && derivWS.readyState === 1) return;

    derivWS = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=" + appId);

    derivWS.onopen = () => {
        if (connectionDStatus) connectionDStatus.style.backgroundColor = "#00ffa3";
        console.log("Conectado a Deriv");
        
        // Si hay una cuenta en el localStorage, la autorizamos
        if (selectedAccount && selectedAccount.token) {
            derivWS.send(JSON.stringify({ authorize: selectedAccount.token }));
        }
    };

    derivWS.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        
        // Manejo de suscripciones de ticks para TradingView
        if (data.msg_type === "tick") {
            const sub = subscriptions.get(data.tick.symbol);
            if (sub) {
                const bar = {
                    time: data.tick.epoch * 1000,
                    close: data.tick.quote,
                    open: data.tick.quote,
                    high: data.tick.quote,
                    low: data.tick.quote,
                };
                sub.callback(bar);
            }
        }

        // Actualización de balance en la interfaz
        if (data.msg_type === "balance") {
            const balance = data.balance.balance;
            const balanceEl = document.getElementById("balance");
            if (balanceEl) balanceEl.innerText = `$ ${balance.toLocaleString()}`;
        }
    };

    derivWS.onerror = (err) => console.error("Error en WebSocket:", err);
    derivWS.onclose = () => {
        if (connectionDStatus) connectionDStatus.style.backgroundColor = "red";
    };
}

// Función para obtener historial compatible con TradingView
export async function getHistoryDWS(requestData, firstDataRequest) {
    if (!derivWS || derivWS.readyState !== 1) initDerivWSConnection();

    return new Promise((resolve) => {
        const msgId = Date.now();
        const msg = {
            ticks_history: requestData.symbol,
            adjust_start_time: 1,
            count: 1000,
            end: "latest",
            start: requestData.from,
            style: "candles",
            granularity: parseInt(requestData.period) * 60 || 60,
        };

        const handler = (event) => {
            const data = JSON.parse(event.data);
            if (data.msg_type === "candles") {
                derivWS.removeEventListener("message", handler);
                resolve(data.candles);
            }
        };

        derivWS.addEventListener("message", handler);
        derivWS.send(JSON.stringify(msg));
    });
}

// Funciones necesarias para el Datafeed
export function getSymbols() {
    return Promise.resolve([
        { symbol: 'R_100', displayName: 'Volatility 100 Index', type: 'stock', exchange: 'Deriv', pip: 0.01 },
        { symbol: 'R_50', displayName: 'Volatility 50 Index', type: 'stock', exchange: 'Deriv', pip: 0.01 }
    ]);
}

export function subscribeOnStream(symbolInfo, resolution, onRealtimeCallback, subscriberUID) {
    const sub = { symbol: symbolInfo.name, callback: onRealtimeCallback };
    subscriptions.set(symbolInfo.name, sub);
    if (derivWS && derivWS.readyState === 1) {
        derivWS.send(JSON.stringify({ ticks: symbolInfo.name, subscribe: 1 }));
    }
}

export function unsubscribeFromStream(subscriberUID) {
    // Lógica para quitar suscripción
}

initDerivWSConnection();