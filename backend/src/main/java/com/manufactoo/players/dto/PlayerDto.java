package com.manufactoo.players.dto;

import java.time.Instant;

/** Vista de un Player para el panel de administracion (Estaciones > Players). */
public record PlayerDto(
        Long id,
        String name,
        String hostname,
        Long stationId,
        String stationName,
        String playerVersion,
        Instant lastSeenAt,
        boolean pendingPairing,
        String pairingCode,
        boolean paired
) {
}
