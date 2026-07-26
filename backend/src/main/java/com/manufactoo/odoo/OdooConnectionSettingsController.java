package com.manufactoo.odoo;

import com.manufactoo.crypto.CryptoService;
import com.manufactoo.odoo.dto.OdooConnectionDto;
import com.manufactoo.odoo.dto.OdooTestConnectionRequest;
import com.manufactoo.odoo.dto.OdooTestConnectionResponse;
import com.manufactoo.odoo.dto.UpdateOdooConnectionRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/api/settings/odoo-connection")
public class OdooConnectionSettingsController {

    private final OdooConnectionRepository repository;
    private final OdooConnectionService odooConnectionService;
    private final CryptoService cryptoService;

    public OdooConnectionSettingsController(OdooConnectionRepository repository,
                                             OdooConnectionService odooConnectionService,
                                             CryptoService cryptoService) {
        this.repository = repository;
        this.odooConnectionService = odooConnectionService;
        this.cryptoService = cryptoService;
    }

    @GetMapping
    public ResponseEntity<OdooConnectionDto> get() {
        return repository.findAll().stream().findFirst()
                .map(OdooConnectionDto::from)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping
    public ResponseEntity<OdooConnectionDto> update(@Valid @RequestBody UpdateOdooConnectionRequest request) {
        return repository.findAll().stream().findFirst()
                .map(connection -> {
                    connection.setHost(request.host());
                    connection.setPort(request.port());
                    connection.setDatabase(request.database());
                    connection.setUsername(request.username());
                    if (request.apiKeyOrPassword() != null && !request.apiKeyOrPassword().isBlank()) {
                        connection.setApiKeyEncrypted(cryptoService.encrypt(request.apiKeyOrPassword()));
                    }
                    repository.save(connection);
                    return ResponseEntity.ok(OdooConnectionDto.from(connection));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /** Reutiliza el mismo servicio de test que el wizard (POST /api/wizard/odoo/test-connection). */
    @PostMapping("/test")
    public ResponseEntity<OdooTestConnectionResponse> test(@Valid @RequestBody(required = false) OdooTestConnectionRequest overrideRequest) {
        var connectionOpt = repository.findAll().stream().findFirst();
        if (connectionOpt.isEmpty() && overrideRequest == null) {
            return ResponseEntity.notFound().build();
        }

        OdooTestConnectionResponse response;
        if (overrideRequest != null) {
            response = OdooTestConnectionResponse.from(odooConnectionService.testConnection(
                    overrideRequest.host(), overrideRequest.port(), overrideRequest.database(),
                    overrideRequest.username(), overrideRequest.apiKeyOrPassword()));
        } else {
            OdooConnection connection = connectionOpt.get();
            String apiKey = cryptoService.decrypt(connection.getApiKeyEncrypted());
            response = OdooTestConnectionResponse.from(odooConnectionService.testConnection(
                    connection.getHost(), connection.getPort(), connection.getDatabase(),
                    connection.getUsername(), apiKey));
        }

        connectionOpt.ifPresent(connection -> {
            connection.setLastTestStatus(response.success() ? OdooTestStatus.SUCCESS : OdooTestStatus.FAILURE);
            connection.setLastTestAt(Instant.now());
            connection.setLastTestError(response.errorMessage());
            if (response.odooVersion() != null) {
                connection.setOdooVersion(response.odooVersion());
            }
            repository.save(connection);
        });

        return ResponseEntity.ok(response);
    }
}
