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

/**
 * Registro inmutable append-only de trazabilidad: cada envio del operario en
 * una estacion crea una fila con el mapa de valores capturados. Nunca se
 * actualiza ni se borra desde la aplicacion.
 */
@Entity
@Table(name = "station_trace_records")
@Getter
@Setter
@NoArgsConstructor
public class StationTraceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "station_id", nullable = false)
    private Long stationId;

    @Column(name = "screen_id")
    private Long screenId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "captured_data", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> capturedData = new LinkedHashMap<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
