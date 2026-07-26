package com.manufactoo.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "manufactoo.update-check")
public record UpdateCheckProperties(boolean enabled, String githubRepo) {
}
