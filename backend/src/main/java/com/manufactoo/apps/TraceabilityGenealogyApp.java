package com.manufactoo.apps;

import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Primera app de Manufactoo: trazabilidad y genealogia de fabricacion.
 * Aporta Dispositivos ahora; Estaciones y Rutas se añadiran en proximos
 * prompts sobre esta misma app (no hace falta una app nueva para ellas).
 */
@Component
public class TraceabilityGenealogyApp implements ManufactooApp {

    public static final String KEY = "traceability_genealogy";

    @Override
    public String key() {
        return KEY;
    }

    @Override
    public String nameKey() {
        return "apps.traceabilityGenealogy.name";
    }

    @Override
    public String descriptionKey() {
        return "apps.traceabilityGenealogy.description";
    }

    @Override
    public String version() {
        return "0.1.0";
    }

    @Override
    public List<String> dependsOn() {
        return List.of();
    }
}
