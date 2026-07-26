package com.manufactoo.wizard.dto;

import java.util.Map;

public record WizardStateResponse(int currentStep, Map<String, Object> payload, boolean completed) {
}
