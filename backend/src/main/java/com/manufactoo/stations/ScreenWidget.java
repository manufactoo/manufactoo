package com.manufactoo.stations;

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
@Table(name = "screen_widgets")
@Getter
@Setter
@NoArgsConstructor
public class ScreenWidget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "screen_id", nullable = false)
    private StationScreen screen;

    @Column(name = "widget_type", nullable = false)
    private String widgetType;

    @Column(nullable = false)
    private String label = "";

    /** Clave bajo la que se guarda el valor capturado en trazabilidad (widgets de datos). */
    @Column(name = "binding_key")
    private String bindingKey;

    @Column(nullable = false)
    private boolean required = false;

    /** Dispositivo de entrada que alimenta este campo (p. ej. un lector de codigo de barras). */
    @Column(name = "source_device_id")
    private Long sourceDeviceId;

    /** Evento (topic MQTT de suscripcion) que alimenta este campo. */
    @Column(name = "source_event_id")
    private Long sourceEventId;

    /** Configuracion propia del widget (placeholder, min/max, texto fijo...). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "config", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> config = new LinkedHashMap<>();

    /** Origen de datos de las opciones: {type, staticOptions}. Vacio si no aplica. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "data_source", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> dataSource = new LinkedHashMap<>();

    /** Posicion/tamaño en el grid de 12 columnas: {x, y, w, h}. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "layout", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> layout = new LinkedHashMap<>();

    @Column(name = "order_index", nullable = false)
    private int orderIndex = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
