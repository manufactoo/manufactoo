package com.manufactoo.wizard;

public class WizardAlreadyCompletedException extends RuntimeException {
    public WizardAlreadyCompletedException() {
        super("La instalacion ya se completo anteriormente.");
    }
}
