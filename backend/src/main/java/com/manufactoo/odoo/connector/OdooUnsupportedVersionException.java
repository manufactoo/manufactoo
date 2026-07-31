package com.manufactoo.odoo.connector;

/**
 * La instancia Odoo detectada no es la 18 ni la 19 (unicas soportadas en
 * produccion). Esta clase vive fuera de Spring (no puede recibir Messages
 * por inyeccion), asi que quien la captura (OdooConnectionService) es quien
 * decide el mensaje final en el idioma correcto -- este mensaje del
 * constructor solo queda como getMessage() por defecto para logs/depuracion.
 */
public class OdooUnsupportedVersionException extends RuntimeException {
    private final String detectedVersion;

    public OdooUnsupportedVersionException(String detectedVersion) {
        super("Unsupported Odoo version (detected: " + detectedVersion + "). Use Odoo 18 or 19.");
        this.detectedVersion = detectedVersion;
    }

    public String getDetectedVersion() {
        return detectedVersion;
    }
}
