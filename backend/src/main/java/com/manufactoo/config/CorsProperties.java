package com.manufactoo.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "manufactoo.cors")
public record CorsProperties(String allowedOrigins) {
}
