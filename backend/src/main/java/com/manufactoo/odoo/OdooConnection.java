package com.manufactoo.odoo;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * apiKeyEncrypted contiene el ciphertext AES-256-GCM (nonce + tag embebidos).
 * Nunca se expone en DTOs de salida; ver CryptoService para cifrado/descifrado.
 */
@Entity
@Table(name = "odoo_connection")
@Getter
@Setter
@NoArgsConstructor
public class OdooConnection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String host;

    @Column(nullable = false)
    private Integer port = 8069;

    @Column(name = "database", nullable = false)
    private String database;

    @Column(nullable = false)
    private String username;

    @Column(name = "api_key_encrypted", nullable = false)
    private byte[] apiKeyEncrypted;

    @Column(name = "odoo_version")
    private String odooVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "last_test_status")
    private OdooTestStatus lastTestStatus = OdooTestStatus.NEVER_TESTED;

    @Column(name = "last_test_at")
    private Instant lastTestAt;

    @Column(name = "last_test_error", columnDefinition = "text")
    private String lastTestError;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
