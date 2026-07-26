package com.manufactoo.devices;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Entity
@Table(name = "devices")
@Getter
@Setter
@NoArgsConstructor
public class Device {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DeviceCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DeviceDirection direction;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Transport transport;

    @Column(nullable = false)
    private boolean enabled = true;

    /** Parametros de conexion (dependen del transport: puerto serie, host/puerto TCP, broker MQTT...). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "connection_json", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> connection = new LinkedHashMap<>();

    /** Parametros propios de la categoria (unidad de la bascula, simbologias del scanner...). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "settings_json", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> settings = new LinkedHashMap<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
