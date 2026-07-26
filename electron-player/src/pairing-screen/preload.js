"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Puente minimo, solo para la pantalla de emparejamiento (no comparte nada con
// window.manufactoo, que es el contrato real que ve el runtime de la estacion).
contextBridge.exposeInMainWorld("pairingBridge", {
  onStatus(callback) {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("manufactoo:pairing-status", listener);
    return () => ipcRenderer.removeListener("manufactoo:pairing-status", listener);
  },
});
