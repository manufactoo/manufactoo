package com.manufactoo.odoo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UpdateOdooConnectionRequest(
        @NotBlank String host,
        @NotNull Integer port,
        @NotBlank String database,
        @NotBlank String username,
        /** Si se omite o va vacio, se conserva la credencial cifrada actual. */
        String apiKeyOrPassword
) {
}
