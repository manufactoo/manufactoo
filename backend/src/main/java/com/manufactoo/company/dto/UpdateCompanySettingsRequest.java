package com.manufactoo.company.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateCompanySettingsRequest(
        @NotBlank String name,
        String sector
) {
}
