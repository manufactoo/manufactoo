package com.manufactoo.user.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdatePreferencesRequest(
        @NotBlank String language,
        @NotBlank String theme,
        @NotBlank String accentColor
) {
}
