package com.manufactoo.security;

import com.manufactoo.config.JwtProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

@Service
public class JwtService {

    private final JwtProperties properties;
    private final SecretKey key;

    public JwtService(JwtProperties properties) {
        this.properties = properties;
        String secret = properties.secret();
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "JWT_SECRET no esta configurado. Define la variable de entorno JWT_SECRET antes de arrancar.");
        }
        // HS256 requiere >= 256 bits; si el secreto es mas corto, se deriva una clave de 256 bits.
        this.key = Keys.hmacShaKeyFor(pad(secret.getBytes(StandardCharsets.UTF_8)));
    }

    public String generateToken(Long userId, String email) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("email", email)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(properties.expirationMinutes(), ChronoUnit.MINUTES)))
                .signWith(key)
                .compact();
    }

    public Long parseUserId(String token) {
        String subject = Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
        return Long.valueOf(subject);
    }

    private byte[] pad(byte[] secret) {
        if (secret.length >= 32) {
            return secret;
        }
        byte[] padded = new byte[32];
        System.arraycopy(secret, 0, padded, 0, secret.length);
        return padded;
    }
}
