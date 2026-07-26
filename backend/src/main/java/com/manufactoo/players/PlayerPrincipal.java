package com.manufactoo.players;

/** Principal de Spring Security para una peticion autenticada con X-Player-Token (no es un User). */
public record PlayerPrincipal(StationPlayer player) {
}
