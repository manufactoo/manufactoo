"use strict";

const net = require("net");

/**
 * ZPL_RAW / ESC_POS: la impresora escucha en un socket TCP crudo (host +
 * tcpPort, tipicamente el puerto 9100 "JetDirect") y se le envian los bytes
 * del payload tal cual, sin ningun protocolo intermedio.
 */
function printRaw(device, payload) {
  return new Promise((resolve, reject) => {
    const c = device.connection || {};
    const socket = net.createConnection({ host: c.host, port: Number(c.tcpPort) || 9100 }, () => {
      socket.write(payload, (err) => {
        if (err) {
          reject(err);
          return;
        }
        socket.end();
      });
    });
    socket.setTimeout(Number(c.timeoutMs) || 5000, () => socket.destroy(new Error("Timeout conectando con la impresora")));
    socket.on("error", reject);
    socket.on("close", () => resolve());
  });
}

/** IPP_CUPS: impresion de red estandar (host + cola de impresion). */
function printIpp(device, payload) {
  const ipp = require("ipp");
  const c = device.connection || {};
  const printer = ipp.Printer(`http://${c.host}:631/printers/${c.queue}`);

  return new Promise((resolve, reject) => {
    const message = {
      "operation-attributes-tag": {
        "requesting-user-name": "manufactoo-player",
        "job-name": "manufactoo",
        "document-format": "application/octet-stream",
      },
      data: Buffer.isBuffer(payload) ? payload : Buffer.from(payload),
    };
    printer.execute("Print-Job", message, (err, res) => (err ? reject(err) : resolve(res)));
  });
}

module.exports = { printRaw, printIpp };
