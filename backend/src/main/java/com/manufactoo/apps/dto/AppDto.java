package com.manufactoo.apps.dto;

import java.time.Instant;
import java.util.List;

public record AppDto(
        String key,
        String nameKey,
        String descriptionKey,
        String version,
        boolean installed,
        Instant installedAt,
        List<String> dependsOn,
        /** Claves de dependencias que faltan por instalar (vacio si ya se puede instalar). */
        List<String> missingDependencies
) {
}
