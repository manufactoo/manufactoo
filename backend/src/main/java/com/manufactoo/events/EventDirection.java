package com.manufactoo.events;

public enum EventDirection {
    /** Manufactoo se suscribe: escucha lo que publica la planta en este topic. */
    SUBSCRIBE,
    /** Manufactoo publica: envia datos/comandos a la planta en este topic. */
    PUBLISH
}
