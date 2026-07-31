"use strict";

const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, ipcMain, dialog, session } = require("electron");

// Configuracion por entorno via .env (nunca hardcodeada ni pedida a mano cada
// vez). Se busca en DOS sitios, y basta con que exista uno:
//  - electron-player/.env          -> desarrollo, ejecutando desde el codigo fuente
//  - <carpeta del .exe instalado>/.env -> produccion, lo crea el equipo de la
//    empresa una vez tras instalar, con la URL de SU servidor Manufactoo.
// dotenv nunca sobreescribe una variable ya presente en el entorno, asi que
// una variable exportada a mano (o por npm run dev) siempre gana.
for (const envPath of [
  path.join(__dirname, "..", "..", ".env"),
  path.join(path.dirname(process.execPath), ".env"),
]) {
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
  }
}

// Log de diagnostico a archivo (independiente de la consola: un .exe lanzado
// con doble clic no tiene ninguna).
const LOG_PATH = path.join(app.getPath("userData"), "player-debug.log");
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_PATH, line, "utf-8"); } catch {}
  console.log(msg);
}
const { loadConfig, saveConfig } = require("./config");
const { ManufactooApi } = require("./api");
const { ensurePaired } = require("./pairing");
const { setupAutoUpdater } = require("./updater");

// require("./devices/registry") NO va aqui arriba a proposito: carga
// serialport (modulo nativo), y si su binding no coincide con el ABI de
// Electron empaquetado, un require() a nivel de modulo revienta ANTES de que
// exista ninguna ventana -- eso es "abro el .exe y no pasa nada" (sin
// terminal no se ve ningun error). Se carga de forma perezosa (mas abajo) y
// con captura de errores, para que un fallo del modulo serie no tumbe todo
// el Player: sigue funcionando emparejamiento, MQTT, impresion, runtime web.
function loadDeviceRegistry() {
  try {
    return require("./devices/registry").DeviceRegistry;
  } catch (err) {
    log("No se pudo cargar el modulo de dispositivos (revisa serialport): " + err.message);
    return null;
  }
}

// Visibilidad de errores: un Player empaquetado, lanzado con doble clic, no
// tiene terminal donde ver console.error. Sin esto, cualquier excepcion no
// capturada simplemente cierra el proceso en silencio.
process.on("uncaughtException", (err) => {
  console.error("Excepcion no capturada:", err);
  try {
    dialog.showErrorBox("Manufactoo Player", String((err && err.stack) || err));
  } catch {
    // si ni siquiera el dialogo funciona (p. ej. app aun no ready), no hay mas remedio
  }
});
process.on("unhandledRejection", (reason) => {
  console.error("Promesa rechazada sin capturar:", reason);
});

// Los switches de sandbox/GPU que estaban aqui (--no-sandbox, --disable-gpu,
// --disable-software-rasterizer, --in-process-gpu) se han eliminado porque en
// Electron 32.x causaban inestabilidad (cierre inmediato del proceso, log
// "crashpad_client_win.cc: not connected") en entornos sin aceleracion grafica.
// Si un PC de planta concreto los necesita (VM, RDP, drivers especiales),
// se pasan por linea de comandos o acceso directo, no hardcodeados.
// La aceleracion por hardware SIEMPRE se desactiva: los PCs de planta son
// kioscos que no necesitan GPU, y en algunos entornos (RDP, basic GPU drivers)
// Chromium crashea al arrancar el renderer si la aceleracion esta activa.
app.disableHardwareAcceleration();

// Version de ESTE contrato IPC (ver frontend/src/features/stations/manufactoo-bridge.ts).
// Solo sube en cambios incompatibles; anadir una capacidad nueva NO la sube.
const API_VERSION = "1.0";
const CAPABILITIES = ["serial", "mqtt", "print.ipp", "print.raw"];

const DEVICE_SYNC_INTERVAL_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 60_000;
const STATION_POLL_INTERVAL_MS = 5_000;

const isWindowed = Boolean(process.env.MANUFACTOO_PLAYER_WINDOWED);

let config = {};
let api;
let deviceRegistry;
let currentWindow;

function baseWindowOptions(preloadPath) {
  const opts = {
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  };
  if (!isWindowed) {
    opts.frame = false;
  }
  return opts;
}

function openPairingWindow() {
  log("openPairingWindow: creating BrowserWindow");
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    backgroundColor: "#ff0000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "..", "pairing-screen", "preload.js"),
    },
  });
  if (!isWindowed) win.maximize();
  log("openPairingWindow: loading pairing-screen/index.html");
  win.webContents.on("did-finish-load", () => log("openPairingWindow: did-finish-load"));
  win.webContents.on("did-fail-load", (e, code, desc) => log("openPairingWindow: did-fail-load " + code + " " + desc));
  win.webContents.on("crashed", () => log("openPairingWindow: RENDERER CRASHED"));
  win.loadFile(path.join(__dirname, "..", "pairing-screen", "index.html"));
  return win;
}

/**
 * La pantalla de la estacion es la MISMA app web que un navegador normal
 * carga en /dashboard/stations/:id/run -- el Player no empaqueta ni congela
 * ninguna copia del frontend. Asi, cualquier cambio de diseno o de logica de
 * runtime en el MES llega a todas las estaciones al instante, sin tener que
 * redistribuir el Player (ver docs/estaciones-runtime-y-player.md).
 */
function openStationWindow(stationId) {
  if (!config.frontendUrl) {
    throw new Error("config.frontendUrl no esta definido: revisa el fichero de configuracion del Player (" + require("./config").configPath() + ").");
  }
  const win = new BrowserWindow(baseWindowOptions(path.join(__dirname, "..", "preload", "index.js")));
  if (!isWindowed) win.maximize();
  const runtimeUrl = `${config.frontendUrl.replace(/\/$/, "")}/dashboard/stations/${stationId}/run`;
  log("openStationWindow: loading " + runtimeUrl);
  win.loadURL(runtimeUrl);
  const DeviceRegistry = loadDeviceRegistry();
  deviceRegistry = DeviceRegistry ? new DeviceRegistry(win.webContents) : null;
  return win;
}

/**
 * IDs de dispositivo/evento que de verdad usa algun widget de la estacion
 * asignada a este Player -- /api/devices y /api/events devuelven TODOS los
 * de la instalacion (otras estaciones incluidas, o dispositivos sueltos sin
 * usar todavia), asi que sin este filtro el Player intentaria abrir puerto
 * serie o suscribirse a MQTT para cosas que no son suyas.
 */
async function stationDeviceAndEventIds() {
  const deviceIds = new Set();
  const eventIds = new Set();
  if (!config.stationId) return { deviceIds, eventIds };
  const station = await api.getStation(config.stationId, config.token);
  for (const screen of station.screens ?? []) {
    for (const widget of screen.widgets ?? []) {
      if (widget.sourceDeviceId) deviceIds.add(widget.sourceDeviceId);
      if (widget.sourceEventId) eventIds.add(widget.sourceEventId);
    }
  }
  return { deviceIds, eventIds };
}

async function syncDevicesAndEvents() {
  if (!config.token || !deviceRegistry) return;
  try {
    const [devices, events, { deviceIds, eventIds }] = await Promise.all([
      api.listDevices(config.token),
      api.listEvents(config.token),
      stationDeviceAndEventIds(),
    ]);
    deviceRegistry.syncDevices(devices.filter((d) => d.enabled && deviceIds.has(d.id)));
    deviceRegistry.syncEvents(events.filter((e) => e.enabled && eventIds.has(e.id)), config.mqttBrokerUrl);
  } catch (err) {
    log("No se pudieron sincronizar dispositivos/eventos: " + err.message);
  }
}

function registerIpcHandlers() {
  // sendSync: el preload necesita estos valores de forma sincrona para poder
  // exponer window.manufactoo ANTES de que la pagina empiece a ejecutarse.
  ipcMain.on("manufactoo:get-info-sync", (event) => {
    event.returnValue = {
      apiVersion: API_VERSION,
      playerVersion: app.getVersion(),
      capabilities: CAPABILITIES,
      playerToken: config.token || null,
    };
  });

  ipcMain.handle("manufactoo:get-station-id", () => config.stationId ?? null);

  ipcMain.handle("manufactoo:print", async (_event, deviceId, payload) => {
    if (!deviceRegistry) throw new Error("El modulo de dispositivos no esta disponible en este Player.");
    const devices = await api.listDevices(config.token);
    const device = devices.find((d) => d.id === deviceId);
    if (!device) throw new Error(`Dispositivo ${deviceId} no encontrado`);
    return deviceRegistry.print(device, payload);
  });

  ipcMain.handle("manufactoo:publish-event", async (_event, eventId, payload) => {
    if (!deviceRegistry) throw new Error("El modulo de dispositivos no esta disponible en este Player.");
    const events = await api.listEvents(config.token);
    const ev = events.find((e) => e.id === eventId);
    if (!ev) throw new Error(`Evento ${eventId} no encontrado`);
    return deviceRegistry.publishEvent(ev, config.mqttBrokerUrl, payload);
  });
}

/** Sondea /api/players/me hasta que un administrador asigne una estacion desde el panel web. */
function waitForStationAssignment(win) {
  win.webContents.send("manufactoo:pairing-status", { status: "PAIRED_NO_STATION" });
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      try {
        const me = await api.me(config.token);
        if (me.stationId) {
          clearInterval(interval);
          resolve(me.stationId);
        }
      } catch (err) {
        log("Error consultando /api/players/me: " + err.message);
      }
    }, STATION_POLL_INTERVAL_MS);
  });
}

function setupPlayerWebRequestFilter(backendUrl, token) {
  if (!token) {
    log("setupPlayerWebRequestFilter: no token, skipping");
    return;
  }
  const base = backendUrl.replace(/\/$/, "");
  log("setupPlayerWebRequestFilter: intercepting requests to " + base);
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.startsWith(base)) {
      details.requestHeaders["X-Player-Token"] = token;
    }
    callback({ requestHeaders: details.requestHeaders });
  });
}

async function main() {
  log("main() starting");
  await app.whenReady();
  log("app.whenReady() OK");
  registerIpcHandlers();

  config = loadConfig();
  log("loadConfig() OK, hasToken=" + !!config.token + " hasStationId=" + !!config.stationId);
  config.backendUrl = config.backendUrl || process.env.MANUFACTOO_BACKEND_URL || "http://localhost:8080";
  // El runtime de la estacion (React/Vite) y la API (Spring) son origenes
  // DISTINTOS en desarrollo (5173 vs 8080); en produccion normalmente van
  // detras del mismo dominio/reverse proxy, por eso el valor por defecto es
  // simplemente backendUrl. En dev, exporta MANUFACTOO_FRONTEND_URL antes de
  // arrancar (ver npm run start:windowed en package.json / README).
  config.frontendUrl = config.frontendUrl || process.env.MANUFACTOO_FRONTEND_URL || config.backendUrl;
  config = saveConfig(config);
  api = new ManufactooApi(config.backendUrl);

  currentWindow = openPairingWindow();

  try {
    config = await ensurePaired(api, (status) => {
      log("ensurePaired status=" + status.status);
      currentWindow.webContents.send("manufactoo:pairing-status", status);
    });
    log("ensurePaired OK, stationId=" + config.stationId);
  } catch (err) {
    log("ensurePaired FAILED: " + (err && err.message));
    // Si falla el registro/emparejamiento (backend caido), la ventana de
    // emparejamiento sigue abierta mostrando el error. No hacemos return
    // para evitar que el proceso se cierre y deje al operario sin ventana.
    return;
  }

  let stationId = config.stationId;
  if (!stationId) {
    stationId = await waitForStationAssignment(currentWindow);
    config = saveConfig({ ...config, stationId });
  }

  // Registrar el filtro webRequest AHORA que ya tenemos token valido.
  // Antes se registraba antes de emparejar (sin token) y nunca se re-registraba,
  // por lo que la station window cargaba la URL sin X-Player-Token -> 403 -> blanco.
  setupPlayerWebRequestFilter(config.backendUrl, config.token);

  const oldWindow = currentWindow;
  currentWindow = openStationWindow(stationId);
  oldWindow.destroy();

  setupAutoUpdater(config.backendUrl);

  const heartbeat = () => api.heartbeat(config.token, app.getVersion(), CAPABILITIES).catch((err) => log("heartbeat error: " + err.message));
  heartbeat();
  setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);

  await syncDevicesAndEvents();
  setInterval(syncDevicesAndEvents, DEVICE_SYNC_INTERVAL_MS);
}

app.on("window-all-closed", () => {
  if (deviceRegistry) deviceRegistry.shutdown();
  app.quit();
});

main().catch((err) => {
  log("Fallo iniciando Manufactoo Player: " + (err && err.stack ? err.stack : err));
  try {
    dialog.showErrorBox("Manufactoo Player - fallo al iniciar", String((err && err.stack) || err));
  } catch {
    // no-op
  }
});
