package com.manufactoo.wizard.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public record WizardCompleteRequest(
        @NotBlank String language,

        @Valid @NotNull ExternalOdoo external,

        @NotBlank String companyName,

        String companySector,

        @Valid @NotNull AdminUser admin
) {
    public record ExternalOdoo(
            @NotBlank String host,
            @NotNull Integer port,
            @NotBlank String database,
            @NotBlank String username,
            @NotBlank String apiKeyOrPassword
    ) {
    }

    public record AdminUser(
            @NotBlank String fullName,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, message = "La contrasena debe tener al menos 8 caracteres") String password
    ) {
    }
}
