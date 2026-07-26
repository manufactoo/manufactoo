package com.manufactoo.apps;

import com.manufactoo.apps.dto.AppDto;
import jakarta.annotation.PostConstruct;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class AppService {

    private final AppRegistry registry;
    private final AppRegistrationRepository repository;

    public AppService(AppRegistry registry, AppRegistrationRepository repository) {
        this.registry = registry;
        this.repository = repository;
    }

    /** Da de alta en BBDD (como NOT_INSTALLED) cualquier app registrada en codigo que aun no tenga fila. */
    @PostConstruct
    void syncRegistryWithDatabase() {
        for (ManufactooApp app : registry.all()) {
            if (repository.findById(app.key()).isEmpty()) {
                repository.save(new AppRegistration(app.key()));
            }
        }
    }

    public boolean isInstalled(String key) {
        return repository.findById(key)
                .map(reg -> reg.getStatus() == AppStatus.INSTALLED)
                .orElse(false);
    }

    public List<AppDto> listApps() {
        Map<String, AppRegistration> registrations = repository.findAll().stream()
                .collect(java.util.stream.Collectors.toMap(AppRegistration::getAppKey, r -> r));

        return registry.all().stream()
                .map(app -> toDto(app, registrations.get(app.key())))
                .toList();
    }

    public AppDto install(String key) {
        ManufactooApp app = registry.find(key)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "App no encontrada: " + key));

        List<String> missing = app.dependsOn().stream().filter(dep -> !isInstalled(dep)).toList();
        if (!missing.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Esta app requiere instalar antes: " + String.join(", ", missing));
        }

        AppRegistration registration = repository.findById(key).orElseGet(() -> new AppRegistration(key));
        registration.setStatus(AppStatus.INSTALLED);
        registration.setInstalledAt(Instant.now());
        repository.save(registration);

        return toDto(app, registration);
    }

    public AppDto uninstall(String key) {
        ManufactooApp app = registry.find(key)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "App no encontrada: " + key));

        List<String> blockedBy = registry.dependents(key).stream()
                .map(ManufactooApp::key)
                .filter(this::isInstalled)
                .toList();
        if (!blockedBy.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No puedes desinstalar esta app porque otras dependen de ella: " + String.join(", ", blockedBy));
        }

        AppRegistration registration = repository.findById(key).orElseGet(() -> new AppRegistration(key));
        registration.setStatus(AppStatus.NOT_INSTALLED);
        registration.setInstalledAt(null);
        repository.save(registration);

        return toDto(app, registration);
    }

    private AppDto toDto(ManufactooApp app, AppRegistration registration) {
        boolean installed = registration != null && registration.getStatus() == AppStatus.INSTALLED;
        List<String> missing = app.dependsOn().stream().filter(dep -> !isInstalled(dep)).toList();
        return new AppDto(
                app.key(),
                app.nameKey(),
                app.descriptionKey(),
                app.version(),
                installed,
                registration != null ? registration.getInstalledAt() : null,
                app.dependsOn(),
                missing
        );
    }
}
