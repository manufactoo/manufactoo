package com.manufactoo.apps;

import java.util.List;

/**
 * Definicion en codigo de una app instalable. Las apps concretas se
 * registran como beans de Spring implementando esta interfaz; el
 * AppRegistry las recoge automaticamente al arrancar.
 *
 * Las dependencias entre apps (dependsOn) son una propiedad del CODIGO,
 * no datos editables por el usuario, asi que no se persisten en BBDD:
 * la unica cosa mutable por instalacion es el estado (ver AppStatus).
 */
public interface ManufactooApp {

    /** Identificador estable, ej. "traceability_genealogy". Nunca cambia entre versiones. */
    String key();

    /** Clave i18n del nombre mostrado en la pantalla de Aplicaciones. */
    String nameKey();

    /** Clave i18n de la descripcion mostrada en la pantalla de Aplicaciones. */
    String descriptionKey();

    /** Version propia de la app, independiente de la version de Manufactoo. */
    String version();

    /** Claves de otras apps que deben estar instaladas antes que esta. */
    List<String> dependsOn();
}
