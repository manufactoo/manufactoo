"use strict";

const mqtt = require("mqtt");

/**
 * Un unico cliente MQTT compartido por Player (no uno por Event): se suscribe
 * a los topics de los Events con direccion SUBSCRIBE y permite publicar en
 * los de direccion PUBLISH. El broker en si es el mismo que usa Manufactoo
 * (o cualquier broker accesible desde la LAN de la planta); su URL se
 * configura junto al resto de la config del Player.
 */
function connectMqtt(brokerUrl) {
  const client = mqtt.connect(brokerUrl, { reconnectPeriod: 3000 });
  client.on("error", (err) => console.error("[mqtt] error:", err.message));
  return client;
}

module.exports = { connectMqtt };
