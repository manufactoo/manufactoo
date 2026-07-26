package com.manufactoo.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "manufactoo.wizard")
public record WizardProperties(boolean allowReset) {
}
