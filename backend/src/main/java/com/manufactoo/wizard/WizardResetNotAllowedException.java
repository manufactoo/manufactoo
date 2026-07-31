package com.manufactoo.wizard;

/** El mensaje real (traducido) lo decide GlobalExceptionHandler via Messages -- este solo queda para logs/depuracion. */
public class WizardResetNotAllowedException extends RuntimeException {
    public WizardResetNotAllowedException() {
        super("Wizard reset is disabled in this environment (only available in development mode).");
    }
}
