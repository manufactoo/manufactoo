"use strict";

const os = require("os");
const { loadConfig, saveConfig } = require("./config");

const POLL_INTERVAL_MS = 3000;

/**
 * Flujo de emparejamiento ("device code flow", como una smart TV): si ya hay
 * un token guardado, no hace nada. Si no, registra este Player (o retoma un
 * registro anterior si la app se cerro a mitad de emparejar) y sondea hasta
 * que un administrador lo asigne a una estacion desde el panel web.
 *
 * onStatus(status) se llama en cada cambio para que la pantalla de
 * emparejamiento pueda mostrar el codigo y el estado actual.
 */
async function ensurePaired(api, onStatus) {
  const existing = loadConfig();
  if (existing.token) {
    // Validar que el token sigue siendo reconocido por el backend antes de
    // confiar en el. Si fue revocado desde el panel (desemparejar), el
    // backend devuelve 401/403 y hay que forzar un re-emparejamiento.
    try {
      await api.me(existing.token);
      return existing;
    } catch {
      console.log("Token local invalidado en el backend, limpiando y re-emparejando...");
      saveConfig({ ...loadConfig(), token: undefined, stationId: undefined });
    }
  }

  return new Promise((resolve, reject) => {
    (async () => {
      let config = existing;
      try {
        if (!config.pairingId) {
          const registered = await api.registerPlayer(os.hostname());
          config = saveConfig({ ...config, pairingId: registered.pairingId, pairingCode: registered.pairingCode });
        }
        onStatus({ status: "PENDING", pairingCode: config.pairingCode });
      } catch (err) {
        onStatus({ status: "ERROR", error: String(err.message || err) });
        reject(err);
        return;
      }

      const interval = setInterval(async () => {
        try {
          const result = await api.pollPairing(config.pairingId);

          if (result.status === "PAIRED") {
            clearInterval(interval);
            const paired = saveConfig({
              ...loadConfig(),
              token: result.token,
              stationId: result.stationId,
              pairingId: undefined,
              pairingCode: undefined,
            });
            onStatus({ status: "PAIRED" });
            resolve(paired);
            return;
          }

          if (result.status === "EXPIRED" || result.status === "NOT_FOUND" || result.status === "ALREADY_DELIVERED") {
            clearInterval(interval);
            // El codigo ya no sirve: se limpia para que el siguiente arranque
            // registre uno nuevo en vez de quedarse sondeando algo muerto.
            saveConfig({ ...loadConfig(), pairingId: undefined, pairingCode: undefined });
            onStatus({ status: result.status });
            reject(new Error(result.status));
            return;
          }

          onStatus({ status: "PENDING", pairingCode: config.pairingCode });
        } catch (err) {
          onStatus({ status: "ERROR", error: String(err.message || err) });
        }
      }, POLL_INTERVAL_MS);
    })();
  });
}

module.exports = { ensurePaired };
