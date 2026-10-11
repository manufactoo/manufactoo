package com.manufactoo.stations;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
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

    /**
     * Foto congelada de que clave(s) de identificador (la fija "identifier"
     * del checkbox de la estacion, y/o la de alguna ruta con clave legada
     * distinta) se le aplicaban a ESTE registro en el momento de guardarse
     * (ver StationService.resolveIdentifierKeys) -- usada por la Genealogia
     * para agrupar unidades entre estaciones sin depender de la
     * configuracion ACTUAL de la ruta, que puede cambiar despues.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "route_identifier_keys", columnDefinition = "jsonb", nullable = false)
    private List<String> routeIdentifierKeys = new ArrayList<>();

    /**
     * Resultado de calidad del paso (OK/NG), opcional -- lo fija un BUTTON con
     * action=SUBMIT y config.result en tiempo de diseno (ver WidgetCatalog).
     * null significa "esta estacion no usa el concepto de OK/NG", no "fallo" --
     * asi las estaciones existentes sin estos botones se comportan igual que
     * antes. Un NG bloquea el siguiente paso de cualquier ruta que use el
     * identificador de este registro (ver StationService.resolveIdentifierKeys).
     */
    @Column(name = "result", length = 10)
    private String result;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
