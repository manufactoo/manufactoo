package com.manufactoo.wizard.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import java.util.Map;

public record WizardStateSaveRequest(
        @Min(1) @Max(5) int currentStep,
        Map<String, Object> payload
) {
}
