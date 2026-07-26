package com.manufactoo.players.dto;

public record RegisterPlayerResponse(String pairingId, String pairingCode, long expiresInSeconds) {
}
