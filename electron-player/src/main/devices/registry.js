"use strict";

const { openSerialDevice } = require("./serial");
const { connectMqtt } = require("./mqtt");
const { printRaw, printIpp } = require("./print");

/**
 * Punto unico donde el Player traduce el Transport de cada Device (definido
 * en el backend, ver DeviceCatalog.java) a una conexion nativa real, y
 * reenvia cada dato entrante al renderer via IPC (manufactoo:device-data /
 * manufactoo:event-data), donde el preload lo expone como window.manufactoo.
 *
 * USB_HID no aparece aqui a proposito: un lector en emulacion de teclado ya
 * escribe directamente en el campo con foco de la pagina web, sin que el
 * Player tenga que hacer nada especial (funciona igual en un navegador
 * normal). Solo los transportes que de verdad necesitan acceso nativo al
 * sistema (puerto serie, sockets TCP crudos) pasan por aqui.
 *
 * Punto de extension: anadir un Transport nuevo en el backend (p. ej. un PLC
 * por Modbus TCP) solo requiere anadir su rama aqui y en `capabilities`
 * (main/index.js) -- el resto del contrato (window.manufactoo) no cambia.
 */
class DeviceRegistry {
  constructor(webContents) {
    this.webContents = webContents;
    this.serialPorts = new Map(); // deviceId -> SerialPort
    this.mqttClient = null;
    this.mqttSubscriptions = new Map(); // eventId -> topic
  }

  emitDeviceData(deviceId, raw) {
    if (!this.webContents.isDestroyed()) {
      this.webContents.send("manufactoo:device-data", deviceId, raw);
    }
  }

  emitEventData(eventId, raw) {
    if (!this.webContents.isDestroyed()) {
      this.webContents.send("manufactoo:event-data", eventId, raw);
    }
  }

  /** Abre los dispositivos SERIAL nuevos; cierra los que ya no estan en la lista (borrados/deshabilitados). */
  syncDevices(devices) {
    const currentIds = new Set(devices.map((d) => d.id));

    for (const [deviceId, port] of this.serialPorts) {
      if (!currentIds.has(deviceId)) {
        port.close();
        this.serialPorts.delete(deviceId);
      }
    }

    for (const device of devices) {
      if (device.transport === "SERIAL" && device.direction !== "OUTPUT" && !this.serialPorts.has(device.id)) {
        try {
          const port = openSerialDevice(device, (raw) => this.emitDeviceData(device.id, raw));
          this.serialPorts.set(device.id, port);
        } catch (err) {
          console.error(`No se pudo abrir el dispositivo serie ${device.id} (${device.name}):`, err.message);
        }
      }
    }
  }

  /** Se suscribe a los Events de entrada nuevos; requiere una URL de broker MQTT configurada. */
  syncEvents(events, mqttBrokerUrl) {
    if (!mqttBrokerUrl) return;
    if (!this.mqttClient) {
      this.mqttClient = connectMqtt(mqttBrokerUrl);
      this.mqttClient.on("message", (topic, payload) => {
        for (const [eventId, subscribedTopic] of this.mqttSubscriptions) {
          if (subscribedTopic === topic) {
            this.emitEventData(eventId, payload.toString());
          }
        }
      });
    }

    for (const event of events) {
      if (event.direction === "SUBSCRIBE" && !this.mqttSubscriptions.has(event.id)) {
        this.mqttClient.subscribe(event.topic);
        this.mqttSubscriptions.set(event.id, event.topic);
      }
    }
  }

  print(device, payload) {
    if (device.transport === "IPP_CUPS") {
      return printIpp(device, payload);
    }
    return printRaw(device, payload);
  }

  publishEvent(event, mqttBrokerUrl, payload) {
    if (!this.mqttClient) {
      this.mqttClient = connectMqtt(mqttBrokerUrl);
    }
    return new Promise((resolve, reject) => {
      this.mqttClient.publish(event.topic, payload, (err) => (err ? reject(err) : resolve()));
    });
  }

  shutdown() {
    for (const port of this.serialPorts.values()) {
      port.close();
    }
    this.serialPorts.clear();
    if (this.mqttClient) {
      this.mqttClient.end(true);
      this.mqttClient = null;
    }
  }
}

module.exports = { DeviceRegistry };
