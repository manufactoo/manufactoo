package com.manufactoo.players.dto;

/**
 * Resultado de sondear el emparejamiento (el Player llama a esto cada pocos
 * segundos). El token solo se entrega UNA VEZ (la primera vez que status
 * pasa a PAIRED); si el Player pierde esa respuesta debe volver a emparejarse
 * desde cero (status ALREADY_DELIVERED), igual que el "device code flow"
 * de OAuth.
 */
public record PairingStatusResponse(String status, String token, Long stationId) {

    public static PairingStatusResponse pending() {
        return new PairingStatusResponse("PENDING", null, null);
    }

    public static PairingStatusResponse expired() {
        return new PairingStatusResponse("EXPIRED", null, null);
    }

    public static PairingStatusResponse notFound() {
        return new PairingStatusResponse("NOT_FOUND", null, null);
    }

    public static PairingStatusResponse alreadyDelivered() {
        return new PairingStatusResponse("ALREADY_DELIVERED", null, null);
    }

    public static PairingStatusResponse paired(String token, Long stationId) {
        return new PairingStatusResponse("PAIRED", token, stationId);
    }
}
