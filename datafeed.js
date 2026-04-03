import { subscribeOnStream, unsubscribeFromStream, getSymbols, getHistoryDWS } from "./streaming.js";

const lastBarsCache = new Map();

export default {
    onReady: (callback) => {
        console.log("✅ Datafeed Ready");
        setTimeout(() => callback({ supported_resolutions: ['1', '5', '15', '30', '60', 'D'] }), 0);
    },

    searchSymbols: (userInput, exchange, symbolType, onResultReadyCallback) => {
        const symbols = getSymbols();
        const filtered = symbols.filter(s => s.symbol.includes(userInput.toUpperCase()));
        onResultReadyCallback(filtered);
    },

    resolveSymbol: (symbolName, onSymbolResolvedCallback, onResolveErrorCallback) => {
        // Configuramos la escala para que las líneas de órdenes salgan perfectas
        const scales = { 'R_10': 100, 'R_25': 100, 'R_50': 100, 'R_75': 100, 'R_100': 100 };
        const priceScale = scales[symbolName] || 100;

        const symbolInfo = {
            name: symbolName,
            ticker: symbolName,
            full_name: symbolName,
            description: symbolName,
            type: 'stock',
            session: '24x7',
            timezone: 'Etc/UTC',
            exchange: 'Deriv',
            minmov: 1,
            pricescale: priceScale,
            has_intraday: true,
            supported_resolutions: ['1', '5', '15', '30', '60', 'D'],
            data_status: 'streaming',
        };
        setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0);
    },

    getBars: async (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) => {
        const { from, to, firstDataRequest } = periodParams;
        const res = resolution || '1';

        try {
            // Usamos el nombre del símbolo directamente
            const bars = await getHistoryDWS(symbolInfo.name, from, to, res);
            
            if (!bars || bars.length === 0) {
                onHistoryCallback([], { noData: true });
                return;
            }

            if (firstDataRequest) {
                lastBarsCache.set(symbolInfo.name, { ...bars[bars.length - 1] });
            }

            onHistoryCallback(bars, { noData: false });
        } catch (error) {
            console.error("❌ Error en getBars:", error);
            onHistoryCallback([], { noData: true });
        }
    },

    subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscribeUID) => {
        subscribeOnStream(symbolInfo, resolution, (bar) => {
            onRealtimeCallback(bar);
        }, subscribeUID);
    },

    unsubscribeBars: (subscriberUID) => {
        unsubscribeFromStream(subscriberUID);
    }
};
