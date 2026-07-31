"use strict";

/**
 * Cliente HTTP fino contra el backend de Manufactoo. Reutiliza EXACTAMENTE
 * los mismos endpoints publicos que ya usa el frontend web (GET /api/stations,
 * /api/devices, /api/events...): el Player no tiene una API paralela que
 * mantener sincronizada, solo se autentica de otra forma (X-Player-Token en
 * vez de un JWT de usuario). Asi, cualquier cambio futuro en esos endpoints
 * (nuevos campos, nuevos tipos de widget) no rompe al Player salvo que
 * necesite ademas una capacidad NATIVA nueva (un transporte de dispositivo
 * distinto), que es justo lo que declara `capabilities`.
 */
class ManufactooApi {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async registerPlayer(hostname) {
    return this._json("POST", "/api/players/register", { hostname });
  }

  async pollPairing(pairingId) {
    return this._json("GET", `/api/players/register/${encodeURIComponent(pairingId)}`);
  }

  async me(token) {
    return this._json("GET", "/api/players/me", null, token);
  }

  async heartbeat(token, playerVersion, capabilities) {
    return this._json("POST", "/api/players/heartbeat", { playerVersion, capabilities }, token);
  }

  async listDevices(token) {
    return this._json("GET", "/api/devices", null, token);
  }

  async listEvents(token) {
    return this._json("GET", "/api/events", null, token);
  }

  /** Mismo endpoint que ya usa la pagina web del runtime, para saber que dispositivos/eventos usan de verdad los widgets de esta estacion (ver stationDeviceAndEventIds en index.js). */
  async getStation(stationId, token) {
    return this._json("GET", `/api/stations/${encodeURIComponent(stationId)}`, null, token);
  }

  async _json(method, path, body, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["X-Player-Token"] = token;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${method} ${path} -> HTTP ${res.status} ${text}`);
    }
    // Algunos endpoints (p. ej. heartbeat) devuelven 200 con el cuerpo vacio
    // en vez de 204 (un metodo void de Spring no anade @ResponseStatus): sin
    // esto, res.json() sobre una cadena vacia revienta con "Unexpected end
    // of JSON input".
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
}

module.exports = { ManufactooApi };
