package com.manufactoo.wizard;

/** El mensaje real (traducido) lo decide GlobalExceptionHandler via Messages -- este solo queda para logs/depuracion. */
public class WizardAlreadyCompletedException extends RuntimeException {
    public WizardAlreadyCompletedException() {
        super("Installation was already completed previously.");
    }
}
