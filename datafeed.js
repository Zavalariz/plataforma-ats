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
        const symbolInfo = {
            name: symbolName,
            full_name: symbolName,
            description: symbolName,
            type: 'stock',
            session: '24x7',
            timezone: 'Etc/UTC',
            exchange: 'Deriv',
            minmov: 1,
            pricescale: 100,
            has_intraday: true,
            supported_resolutions: ['1', '5', '15', '30', '60', 'D'],
            data_status: 'streaming',
        };
        setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0);
    },

    getBars: async (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) => {
        const { from, to, firstDataRequest } = periodParams;
        
        // FORZAR resolución si viene undefined
        const res = resolution || '1';

        try {
            const bars = await getHistoryDWS(symbolInfo.name, from, to, res);
            
            if (bars.length === 0) {
                onHistoryCallback([], { noData: true });
                return;
            }

            if (firstDataRequest) {
                lastBarsCache.set(symbolInfo.name, { ...bars[bars.length - 1] });
            }

            onHistoryCallback(bars, { noData: false });
        } catch (error) {
            console.error("❌ Error en getBars:", error);
            onErrorCallback(error);
        }
    },

    subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscribeUID, onResetCacheNeededCallback) => {
        subscribeOnStream(symbolInfo, resolution, (bar) => {
            onRealtimeCallback(bar);
        }, subscribeUID);
    },

    unsubscribeBars: (subscriberUID) => {
        unsubscribeFromStream(subscriberUID);
    }
};
