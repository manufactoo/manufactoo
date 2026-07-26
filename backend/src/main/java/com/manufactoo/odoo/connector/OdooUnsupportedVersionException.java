package com.manufactoo.odoo.connector;

/** La instancia Odoo detectada no es la 18 ni la 19 (unicas soportadas en produccion). */
public class OdooUnsupportedVersionException extends RuntimeException {
    private final String detectedVersion;

    public OdooUnsupportedVersionException(String detectedVersion) {
        super("Version de Odoo no soportada (detectada: " + detectedVersion + "). Usa Odoo 18 o 19.");
        this.detectedVersion = detectedVersion;
    }

    public String getDetectedVersion() {
        return detectedVersion;
    }
}
