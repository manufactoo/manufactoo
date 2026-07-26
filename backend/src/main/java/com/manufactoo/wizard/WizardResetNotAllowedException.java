package com.manufactoo.wizard;

public class WizardResetNotAllowedException extends RuntimeException {
    public WizardResetNotAllowedException() {
        super("El reseteo del wizard esta deshabilitado en este entorno (solo disponible en modo desarrollo).");
    }
}
