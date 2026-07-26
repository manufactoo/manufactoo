package com.manufactoo.players;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Genera y verifica los identificadores aleatorios del emparejamiento
 * (pairingId, pairingCode, token de dispositivo). El token en si NUNCA se
 * guarda: solo su hash SHA-256, igual que un API token normal (no hace falta
 * bcrypt/Argon2 aqui porque el "secreto" ya es aleatorio de alta entropia, no
 * una contrasena elegida por una persona).
 */
final class PlayerTokenHasher {

    private static final SecureRandom RANDOM = new SecureRandom();
    // Sin caracteres ambiguos (0/O, 1/I/l) para que se pueda leer facilmente en la pantalla del Player.
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private PlayerTokenHasher() {
    }

    static String randomPairingCode() {
        StringBuilder sb = new StringBuilder(6);
        for (int i = 0; i < 6; i++) {
            sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }

    static String randomUrlSafeToken(int bytes) {
        byte[] raw = new byte[bytes];
        RANDOM.nextBytes(raw);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
    }

    static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
