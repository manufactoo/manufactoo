"use strict";

const { contextBridge, ipcRenderer } = require("electron");

/**
 * Puente entre la pagina web de la estacion (renderer, sin nodeIntegration)
 * y el proceso principal (que si tiene acceso a serialport/mqtt/etc). Este
 * es el CONTRATO real que implementa frontend/src/features/stations/manufactoo-bridge.ts
 * en el lado web -- si cambias uno, cambia el otro. Es aditivo a proposito
 * (ver el comentario de esa interfaz): nunca quites ni renombres un campo,
 * solo anade.
 */
const info = ipcRenderer.sendSync("manufactoo:get-info-sync");

contextBridge.exposeInMainWorld("manufactoo", {
  apiVersion: info.apiVersion,
  playerVersion: info.playerVersion,
  capabilities: info.capabilities,
  playerToken: info.playerToken,

  getStationId: () => ipcRenderer.invoke("manufactoo:get-station-id"),

  onDeviceData(deviceId, callback) {
    const listener = (_event, id, raw) => {
      if (id === deviceId) callback(raw);
    };
    ipcRenderer.on("manufactoo:device-data", listener);
    return () => ipcRenderer.removeListener("manufactoo:device-data", listener);
  },

  onEventData(eventId, callback) {
    const listener = (_event, id, raw) => {
      if (id === eventId) callback(raw);
    };
    ipcRenderer.on("manufactoo:event-data", listener);
    return () => ipcRenderer.removeListener("manufactoo:event-data", listener);
  },

  print: (deviceId, payload) => ipcRenderer.invoke("manufactoo:print", deviceId, payload),
  publishEvent: (eventId, payload) => ipcRenderer.invoke("manufactoo:publish-event", eventId, payload),
});
