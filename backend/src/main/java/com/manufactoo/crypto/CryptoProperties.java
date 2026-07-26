package com.manufactoo.crypto;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "manufactoo.crypto")
public record CryptoProperties(String masterKeyPath, String masterKeyInitPath) {
}
