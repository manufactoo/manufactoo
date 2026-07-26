package com.manufactoo.apps;

import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Recoge todas las ManufactooApp registradas como beans de Spring y valida
 * el grafo de dependencias al arrancar (dependencias inexistentes o ciclos
 * abortan el arranque con un mensaje claro, en vez de fallar en silencio
 * mas tarde al intentar instalar una app).
 */
@Component
public class AppRegistry {

    private final Map<String, ManufactooApp> appsByKey;

    public AppRegistry(List<ManufactooApp> apps) {
        Map<String, ManufactooApp> byKey = new LinkedHashMap<>();
        for (ManufactooApp app : apps) {
            if (byKey.putIfAbsent(app.key(), app) != null) {
                throw new IllegalStateException("Hay dos apps registradas con la misma key: " + app.key());
            }
        }
        this.appsByKey = Collections.unmodifiableMap(byKey);
        validateDependencies();
    }

    public Collection<ManufactooApp> all() {
        return appsByKey.values();
    }

    public Optional<ManufactooApp> find(String key) {
        return Optional.ofNullable(appsByKey.get(key));
    }

    /** Apps que declaran `key` como dependencia (para bloquear desinstalaciones). */
    public List<ManufactooApp> dependents(String key) {
        return appsByKey.values().stream()
                .filter(app -> app.dependsOn().contains(key))
                .toList();
    }

    private void validateDependencies() {
        for (ManufactooApp app : appsByKey.values()) {
            for (String dep : app.dependsOn()) {
                if (!appsByKey.containsKey(dep)) {
                    throw new IllegalStateException(
                            "La app '" + app.key() + "' depende de '" + dep + "', que no esta registrada.");
                }
            }
        }

        Set<String> visited = new HashSet<>();
        Set<String> inProgress = new HashSet<>();
        for (String key : appsByKey.keySet()) {
            detectCycle(key, visited, inProgress, new ArrayDeque<>());
        }
    }

    private void detectCycle(String key, Set<String> visited, Set<String> inProgress, Deque<String> path) {
        if (visited.contains(key)) {
            return;
        }
        if (inProgress.contains(key)) {
            path.addLast(key);
            throw new IllegalStateException("Dependencia ciclica entre apps: " + String.join(" -> ", path));
        }

        inProgress.add(key);
        path.addLast(key);
        for (String dep : appsByKey.get(key).dependsOn()) {
            detectCycle(dep, visited, inProgress, path);
        }
        path.removeLast();
        inProgress.remove(key);
        visited.add(key);
    }
}
