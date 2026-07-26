package com.manufactoo.crypto;

import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;

/**
 * Cifrado autenticado AES-256-GCM para el campo odoo_connection.api_key_encrypted.
 * La clave la aporta MasterKeyProvider (nunca se guarda junto a la config de la app).
 */
@Service
public class CryptoService {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_NONCE_LENGTH_BYTES = 12;
    private static final int GCM_TAG_LENGTH_BITS = 128;

    private final MasterKeyProvider masterKeyProvider;
    private final SecureRandom secureRandom = new SecureRandom();

    public CryptoService(MasterKeyProvider masterKeyProvider) {
        this.masterKeyProvider = masterKeyProvider;
    }

    /** Cifra un secreto (ej. API key de Odoo) devolviendo nonce||ciphertext||tag. */
    public byte[] encrypt(String plaintext) {
        try {
            byte[] nonce = new byte[GCM_NONCE_LENGTH_BYTES];
            secureRandom.nextBytes(nonce);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey(), new GCMParameterSpec(GCM_TAG_LENGTH_BITS, nonce));
            byte[] cipherText = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            return ByteBuffer.allocate(nonce.length + cipherText.length)
                    .put(nonce)
                    .put(cipherText)
                    .array();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Fallo cifrando con AES-256-GCM", e);
        }
    }

    /** Descifra el valor producido por encrypt(). */
    public String decrypt(byte[] nonceAndCipherText) {
        try {
            byte[] nonce = Arrays.copyOfRange(nonceAndCipherText, 0, GCM_NONCE_LENGTH_BYTES);
            byte[] cipherText = Arrays.copyOfRange(nonceAndCipherText, GCM_NONCE_LENGTH_BYTES, nonceAndCipherText.length);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, secretKey(), new GCMParameterSpec(GCM_TAG_LENGTH_BITS, nonce));
            byte[] plain = cipher.doFinal(cipherText);

            return new String(plain, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Fallo descifrando con AES-256-GCM (clave maestra incorrecta o dato corrupto)", e);
        }
    }

    private SecretKeySpec secretKey() {
        return new SecretKeySpec(masterKeyProvider.getKey(), "AES");
    }
}
