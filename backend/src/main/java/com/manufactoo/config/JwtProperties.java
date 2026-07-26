package com.manufactoo.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "manufactoo.security.jwt")
public record JwtProperties(String secret, long expirationMinutes) {
}
