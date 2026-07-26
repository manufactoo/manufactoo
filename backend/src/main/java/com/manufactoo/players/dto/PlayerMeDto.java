package com.manufactoo.players.dto;

import com.manufactoo.stations.dto.StationDto;

/** Lo que el Player recibe sobre si mismo: que estacion es (o null si aun no se ha asignado ninguna). */
public record PlayerMeDto(Long stationId, StationDto station) {
}
