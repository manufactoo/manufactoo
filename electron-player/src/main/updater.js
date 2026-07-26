"use strict";

const { autoUpdater } = require("electron-updater");

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // cada hora: es una LAN local, no hay coste ni prisa

/**
 * Actualizacion automatica del Player en si (no de las estaciones, que se
 * actualizan solas al recargar la pagina web -- ver docs/estaciones-runtime-y-player.md
 * seccion 3). El feed apunta al MISMO servidor Manufactoo con el que este
 * Player esta emparejado (nunca a internet): cada empresa aloja sus propias
 * versiones del Player subiendolas desde el panel de administracion.
 *
 * `autoInstallOnAppQuit`: la descarga ocurre en segundo plano sin interrumpir
 * al operario; la instalacion se aplica al cerrar la app (cambio de turno,
 * reinicio del PC), nunca a media faena.
 */
function setupAutoUpdater(backendUrl, log = console) {
  autoUpdater.setFeedURL({ provider: "generic", url: `${backendUrl.replace(/\/$/, "")}/api/player-releases`, channel: "latest" });
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (err) => log.error("[updater] error:", err.message));
  autoUpdater.on("update-available", (info) => log.info("[updater] version disponible:", info.version));
  autoUpdater.on("update-downloaded", (info) => log.info("[updater] descargada, se instalara al cerrar:", info.version));

  const check = () => autoUpdater.checkForUpdates().catch((err) => log.error("[updater] fallo comprobando version:", err.message));
  check();
  return setInterval(check, CHECK_INTERVAL_MS);
}

module.exports = { setupAutoUpdater };
