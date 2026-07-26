package com.manufactoo.odoo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record OdooTestConnectionRequest(
        @NotBlank String host,
        @NotNull Integer port,
        @NotBlank String database,
        @NotBlank String username,
        @NotBlank String apiKeyOrPassword
) {
}
