import { subscribeOnStream, unsubscribeFromStream, getSymbols, getHistoryDWS } from "./streaming.js";

const lastBarsCache = new Map();

export default {
    onReady: (callback) => {
        console.log("✅ Datafeed Ready");
        // Configuramos los parámetros iniciales que TradingView espera
        setTimeout(() => callback({ 
            supported_resolutions: ['1', '5', '15', '30', '60', 'D'],
            exchanges: [{ value: 'Deriv', name: 'Deriv', desc: 'Deriv Broker' }],
            symbols_types: [{ name: 'stock', value: 'stock' }]
        }), 0);
    },

    searchSymbols: (userInput, exchange, symbolType, onResultReadyCallback) => {
        const symbols = getSymbols();
        const filtered = symbols.filter(s => s.symbol.includes(userInput.toUpperCase()));
        onResultReadyCallback(filtered);
    },

    resolveSymbol: (symbolName, onSymbolResolvedCallback, onResolveErrorCallback) => {
        // --- CONFIGURACIÓN DINÁMICA DE PRECIOS ---
        // Esto asegura que las líneas de órdenes se pinten en el lugar exacto
        const symbolScales = {
            'R_10': 100,
            'R_25': 100,
            'R_50': 100,
            'R_75': 100,
            'R_100': 100,
            '1HZ100V': 100,
            'BOOM1000': 100,
            'CRASH1000': 100
        };

        const priceScale = symbolScales[symbolName] || 100;

        const symbolInfo = {
            name: symbolName,
            full_name: symbolName,
            description: symbolName,
            ticker: symbolName, // Crítico para el streaming
            type: 'stock',
            session: '24x7',
            timezone: 'Etc/UTC',
            exchange: 'Deriv',
            minmov: 1,
            pricescale: priceScale,
            has_intraday: true,
            visible_plots_set: 'ohlc', // Crítico para que el gráfico sepa qué dibujar
            supported_resolutions: ['1', '5', '15', '30', '60', 'D'],
            data_status: 'streaming',
            has_ticks: true,
            has_seconds: true
        };
        
        console.log(`🎯 Resolviendo símbolo: ${symbolName} con escala: ${priceScale}`);
        setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0);
    },

    getBars: async (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) => {
        const { from, to, firstDataRequest } = periodParams;
        const res = resolution || '1';

        try {
            // Llamamos a la función de tu streaming.js
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
            onErrorCallback(error);
        }
    },

    subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscribeUID, onResetCacheNeededCallback) => {
        // Conectamos el streaming de Deriv con el gráfico
        subscribeOnStream(symbolInfo, resolution, (bar) => {
            onRealtimeCallback(bar);
        }, subscribeUID);
    },

    unsubscribeBars: (subscriberUID) => {
        unsubscribeFromStream(subscriberUID);
    }
};
