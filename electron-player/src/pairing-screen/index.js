"use strict";

const hintEl = document.getElementById("hint");
const codeEl = document.getElementById("code");
const statusEl = document.getElementById("status");

const MESSAGES = {
  PENDING: "Pide a un administrador que asigne este Player a una estacion desde Manufactoo (Estaciones > Players).",
  PAIRED: "Emparejado. Cargando la estacion...",
  PAIRED_NO_STATION: "Emparejado, pero todavia sin estacion asignada. Esperando...",
  EXPIRED: "El codigo ha caducado. Reinicia el Player para generar uno nuevo.",
  ALREADY_DELIVERED: "Este Player ya se emparejo antes y perdio sus credenciales. Desemparejalo desde el panel y reinicia el Player.",
  NOT_FOUND: "No se reconoce este codigo. Reinicia el Player para generar uno nuevo.",
  ERROR: "No se pudo contactar con el servidor Manufactoo. Reintentando...",
};

window.pairingBridge.onStatus((status) => {
  if (status.pairingCode) {
    codeEl.textContent = status.pairingCode;
    codeEl.style.display = "block";
    hintEl.textContent = "Codigo de emparejamiento de este puesto:";
  } else {
    codeEl.style.display = "none";
  }

  statusEl.textContent = MESSAGES[status.status] || status.status;
  statusEl.className = status.status === "ERROR" ? "status error" : "status";
});
