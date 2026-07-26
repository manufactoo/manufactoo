package com.manufactoo.players.dto;

/** Lo que reporta el Player al arrancar por primera vez, antes de estar emparejado. */
public record RegisterPlayerRequest(String hostname) {
}
