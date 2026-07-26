package com.manufactoo.apps;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Estado de instalacion persistido de una ManufactooApp registrada en codigo. */
@Entity
@Table(name = "apps")
@Getter
@Setter
@NoArgsConstructor
public class AppRegistration {

    @Id
    @Column(name = "app_key")
    private String appKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AppStatus status = AppStatus.NOT_INSTALLED;

    @Column(name = "installed_at")
    private Instant installedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public AppRegistration(String appKey) {
        this.appKey = appKey;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
