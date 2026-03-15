import { store } from "./store/store.js";

const appId = '119907';
let derivWS = null;
const messageQueue = []; // Cola para mensajes mientras conecta

export function initDerivWSConnection() {
    if (derivWS && derivWS.readyState <= 1) return;

    derivWS = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`);

    derivWS.onopen = () => {
        console.log("✅ Conectado a Deriv");
        // Enviar mensajes pendientes en la cola
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
        // Manejar datos de velas y ticks aquí
    };

    derivWS.onerror = (err) => console.error("❌ Error WS:", err);
    derivWS.onclose = () => setTimeout(initDerivWSConnection, 5000);
}

// Función segura para enviar mensajes
function safeSend(message) {
    if (derivWS && derivWS.readyState === WebSocket.OPEN) {
        derivWS.send(JSON.stringify(message));
    } else {
        messageQueue.push(message); // Guardar para cuando conecte
    }
}

export function getHistoryDWS(symbol, from, to, resolution) {
    return new Promise((resolve) => {
        const request = {
            ticks_history: symbol,
            adjust_start_time: 1,
            count: 1000,
            end: "latest",
            style: "candles",
            granularity: 60 // Ajustar según resolución
        };
        safeSend(request);
        // Aquí deberías filtrar la respuesta en onmessage y hacer resolve()
    });
}