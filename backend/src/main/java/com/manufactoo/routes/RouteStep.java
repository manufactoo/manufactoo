package com.manufactoo.routes;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "route_steps")
@Getter
@Setter
@NoArgsConstructor
public class RouteStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "route_id", nullable = false)
    private Route route;

    @Column(name = "station_id", nullable = false)
    private Long stationId;

    @Column(name = "order_index", nullable = false)
    private int orderIndex = 0;

    @Column(nullable = false)
    private String name = "";
}
