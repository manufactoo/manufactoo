package com.manufactoo.players.dto;

/** stationId=null desasigna (el Player deja de representar ninguna estacion) sin desemparejarlo del todo. */
public record AssignPlayerRequest(Long stationId, String name) {
}
