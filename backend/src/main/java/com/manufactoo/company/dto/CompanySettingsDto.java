package com.manufactoo.company.dto;

import com.manufactoo.company.CompanySettings;

public record CompanySettingsDto(
        Long id,
        String name,
        String sector,
        boolean hasLogo,
        Long logoUpdatedAt
) {
    public static CompanySettingsDto from(CompanySettings settings) {
        return new CompanySettingsDto(
                settings.getId(),
                settings.getName(),
                settings.getSector(),
                settings.getLogoImage() != null,
                settings.getLogoUpdatedAt() != null ? settings.getLogoUpdatedAt().toEpochMilli() : null
        );
    }
}
