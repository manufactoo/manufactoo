"use strict";

const { app, safeStorage } = require("electron");
const fs = require("fs");
const path = require("path");

function configPath() {
  return path.join(app.getPath("userData"), "manufactoo-player-config.json");
}

/**
 * Configuracion local persistente del Player: URL del backend, estado del
 * emparejamiento y el token de dispositivo (cifrado en disco con
 * safeStorage, que usa el almacen de credenciales del propio sistema
 * operativo -- DPAPI en Windows, Keychain en macOS, libsecret en Linux).
 * Deliberadamente un fichero JSON simple, no una base de datos: es la unica
 * config de un unico proceso, no hace falta mas.
 */
function loadConfig() {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(configPath(), "utf-8"));
  } catch {
    return {};
  }

  if (raw.tokenEncrypted) {
    try {
      raw.token = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(Buffer.from(raw.tokenEncrypted, "base64"))
        : null;
    } catch {
      raw.token = null;
    }
  }
  delete raw.tokenEncrypted;
  return raw;
}

function saveConfig(config) {
  const toSave = { ...config };
  if (toSave.token) {
    toSave.tokenEncrypted = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(toSave.token).toString("base64")
      : undefined;
  }
  delete toSave.token;
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(toSave, null, 2), "utf-8");
  return config;
}

module.exports = { loadConfig, saveConfig, configPath };
