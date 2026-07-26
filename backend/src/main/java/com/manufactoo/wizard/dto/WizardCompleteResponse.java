package com.manufactoo.wizard.dto;

import com.manufactoo.company.dto.CompanySettingsDto;
import com.manufactoo.odoo.dto.OdooConnectionDto;
import com.manufactoo.user.dto.UserDto;

public record WizardCompleteResponse(
        boolean success,
        String redirectTo,
        String token,
        UserDto user,
        CompanySettingsDto company,
        OdooConnectionDto odooConnection
) {
}
