"use strict";

const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const LINE_ENDINGS = { NONE: "", CR: "\r", LF: "\n", CRLF: "\r\n" };

/**
 * Compila connection.valuePattern (ver DeviceCatalog.java) una sola vez por
 * dispositivo, no en cada linea. Sin patron (campo vacio, el caso normal:
 * scanner de barras, o RS232 que ya manda el dato limpio) devuelve null y
 * extractValue se salta el paso, cero coste ni cambio de comportamiento.
 */
function compileValuePattern(pattern, deviceId) {
  if (!pattern) return null;
  try {
    return new RegExp(pattern);
  } catch (err) {
    console.error(`[serial] patron invalido en dispositivo ${deviceId}, se ignora:`, err.message);
    return null;
  }
}

/**
 * Aplica la regex (si hay) a una linea/trozo crudo: usa el primer grupo de
 * captura si el patron tiene uno, o toda la coincidencia si no. Sin
 * coincidencia (o sin patron), se manda el dato tal cual -- fail-open, igual
 * que el resto del catalogo (nunca se bloquea el dato por no encajar).
 */
function extractValue(raw, regex) {
  if (!regex) return raw;
  const match = raw.match(regex);
  if (!match) return raw;
  return match.length > 1 && match[1] !== undefined ? match[1] : match[0];
}

/**
 * Abre un puerto serie segun los campos de conexion del Device tal y como los
 * define DeviceCatalog.java en el backend (port, baudRate, dataBits, stopBits,
 * parity, flowControl, lineEnding, encoding, valuePattern). Todos los
 * dispositivos SERIAL de este catalogo son de ENTRADA (lector de codigo de
 * barras, RS232 generico), asi que esto solo escucha; no hay necesidad de
 * escritura/respuesta.
 */
function openSerialDevice(device, onData) {
  const c = device.connection || {};
  const valuePattern = compileValuePattern(c.valuePattern, device.id);

  const port = new SerialPort({
    path: c.port,
    baudRate: Number(c.baudRate) || 9600,
    dataBits: Number(c.dataBits) || 8,
    stopBits: Number(c.stopBits) || 1,
    parity: (c.parity || "none").toLowerCase(),
    rtscts: c.flowControl === "RTS_CTS",
    xon: c.flowControl === "XON_XOFF",
    xoff: c.flowControl === "XON_XOFF",
    autoOpen: true,
  });

  const delimiter = LINE_ENDINGS[c.lineEnding];
  if (delimiter) {
    const parser = port.pipe(new ReadlineParser({ delimiter }));
    parser.on("data", (line) => onData(extractValue(line, valuePattern)));
  } else {
    const encoding = c.encoding === "LATIN1" ? "latin1" : c.encoding === "ASCII" ? "ascii" : "utf8";
    port.on("data", (buffer) => onData(extractValue(buffer.toString(encoding), valuePattern)));
  }

  port.on("error", (err) => {
    console.error(`[serial] ${c.port} (dispositivo ${device.id}):`, err.message);
  });

  return port;
}

module.exports = { openSerialDevice };
