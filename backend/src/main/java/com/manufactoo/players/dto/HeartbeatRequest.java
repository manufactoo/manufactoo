package com.manufactoo.players.dto;

import java.util.List;

/**
 * Lo que reporta el Player periodicamente. `capabilities` es una lista abierta
 * (p. ej. "serial","mqtt","print.ipp","print.raw") para que el backend pueda
 * en el futuro avisar si una estacion necesita una capacidad que ese Player
 * todavia no soporta, sin necesidad de acoplar versiones exactas.
 */
public record HeartbeatRequest(String playerVersion, List<String> capabilities) {
}
