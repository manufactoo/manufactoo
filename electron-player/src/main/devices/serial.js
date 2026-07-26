"use strict";

const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const LINE_ENDINGS = { NONE: "", CR: "\r", LF: "\n", CRLF: "\r\n" };

/**
 * Abre un puerto serie segun los campos de conexion del Device tal y como los
 * define DeviceCatalog.java en el backend (port, baudRate, dataBits, stopBits,
 * parity, flowControl, lineEnding, encoding). Todos los dispositivos SERIAL de
 * este catalogo son de ENTRADA (lector de codigo de barras, RS232 generico),
 * asi que esto solo escucha; no hay necesidad de escritura/respuesta.
 */
function openSerialDevice(device, onData) {
  const c = device.connection || {};

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
    parser.on("data", (line) => onData(line));
  } else {
    const encoding = c.encoding === "LATIN1" ? "latin1" : c.encoding === "ASCII" ? "ascii" : "utf8";
    port.on("data", (buffer) => onData(buffer.toString(encoding)));
  }

  port.on("error", (err) => {
    console.error(`[serial] ${c.port} (dispositivo ${device.id}):`, err.message);
  });

  return port;
}

module.exports = { openSerialDevice };
