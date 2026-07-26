package com.manufactoo.routes;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Secuencia ordenada de estaciones (RouteStep) por las que debe pasar una
 * unidad de un producto/modelo determinado. Se define por producto (como el
 * routing de una BOM en Odoo), nunca por unidad individual: lo que rastrea
 * cada unidad concreta es `identifierBindingKey` -- la clave de datos (p. ej.
 * "serial", "orden") que StationService.submitRecord usa para comprobar que
 * los pasos anteriores de la ruta ya se completaron para ESA MISMA unidad.
 */
@Entity
@Table(name = "manufacturing_routes")
@Getter
@Setter
@NoArgsConstructor
public class Route {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String description = "";

    /** Id del producto Odoo al que aplica esta ruta (null = aplica independientemente del producto). */
    @Column(name = "product_id")
    private Long productId;

    /** display_name del producto, cacheado solo para mostrarlo sin volver a llamar a Odoo. */
    @Column(name = "product_name")
    private String productName;

    /** Clave de datos que identifica la unidad a lo largo de la ruta (p. ej. "serial", "orden"). */
    @Column(name = "identifier_binding_key", nullable = false)
    private String identifierBindingKey;

    @Column(nullable = false)
    private boolean enabled = true;

    @OneToMany(mappedBy = "route", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC, id ASC")
    private List<RouteStep> steps = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public void addStep(RouteStep step) {
        step.setRoute(this);
        this.steps.add(step);
    }
}
