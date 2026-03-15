import { subscribeOnStream, unsubscribeFromStream, getSymbols, getHistoryDWS } from "./streaming.js";

const configurationData = {
    supported_resolutions: ["1", "2", "3", "5", "10", "15", "30", "60", "120", "240", "480", "1D"],
    exchanges: [{ value: 'Deriv', name: 'Deriv', desc: 'Deriv' }],
    symbols_types: [{ name: 'Indices', value: 'stock' }],
};

export default {
    onReady: (callback) => {
        setTimeout(() => callback(configurationData), 0);
    },

    searchSymbols: async (userInput, exchange, symbolType, onResultReadyCallback) => {
        const symbols = await getSymbols();
        const results = symbols
            .filter(s => s.symbol.toLowerCase().includes(userInput.toLowerCase()))
            .map(s => ({
                symbol: s.symbol,
                full_name: s.symbol,
                description: s.displayName,
                exchange: 'Deriv',
                type: 'stock',
            }));
        onResultReadyCallback(results);
    },

    resolveSymbol: (symbolName, onSymbolResolvedCallback, onResolveErrorCallback) => {
        const symbolInfo = {
            name: symbolName,
            full_name: symbolName,
            description: "Deriv Synthetic Index",
            type: 'stock',
            session: '24x7',
            timezone: 'Etc/UTC',
            exchange: 'Deriv',
            minmov: 1,
            pricescale: 100,
            has_intraday: true,
            supported_resolutions: ['1', '5', '15', '30', '60'],
            data_status: 'streaming',
        };
        
        // IMPORTANTE: Asegúrate de que no devuelves nada 'undefined'
        setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0);
    },

    getBars: async (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) => {
        const { from, to, firstDataRequest } = periodParams;

        try {
            const requestData = {
                symbol: symbolInfo.name,
                period: resolution,
                from: from,
                to: to,
            };

            // Llamamos a tu función de streaming.js
            const history = await getHistoryDWS(requestData, firstDataRequest);
            
            if (!history || history.length === 0) {
                onHistoryCallback([], { noData: true });
                return;
            }

            const bars = history.map(bar => ({
                time: bar.epoch * 1000, // TradingView usa milisegundos
                low: parseFloat(bar.low),
                high: parseFloat(bar.high),
                open: parseFloat(bar.open),
                close: parseFloat(bar.close),
            }));

            // Ordenar por tiempo para evitar errores visuales
            bars.sort((a, b) => a.time - b.time);

            onHistoryCallback(bars, { noData: false });
        } catch (error) {
            console.error("Error en getBars:", error);
            onErrorCallback(error);
        }
    },

    subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) => {
        subscribeOnStream(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback);
    },

    unsubscribeBars: (subscriberUID) => {
        unsubscribeFromStream(subscriberUID);
    },
};