// store/store.js - Versión compatible para navegador local
export const store = {
    getState: () => ({
        // Estos son los estados que tus otros archivos buscan
        derivWS: null,
        barsData: {},
        chart: null,
        symbols: [],
        balance: "0.00",
        
        // Estas son las funciones (setters) que tus archivos llaman
        setDerivWS: (ws) => { console.log("WS Guardado en store"); },
        setLastBar: (bar) => {},
        setBalance: (bal) => { 
            const el = document.getElementById("balance");
            if(el) el.innerText = `$ ${bal}`;
        },
        setSymbols: (syms) => {},
        setPositionsData: (data) => {},
        setCommission: (comm) => {},
        setSymbolInfo: (info) => {},
        setBarsData: (data) => {},
        setLoading: (state) => {}
    })
};

// Si tus otros archivos usan 'useStore' como un hook de React, 
// esta línea evita que el código explote:
export const useStore = () => store.getState();