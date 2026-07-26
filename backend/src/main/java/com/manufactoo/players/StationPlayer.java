package com.manufactoo.players;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Un puesto fisico (un PC de planta) que ejecuta el Manufactoo Player
 * (Electron). No es un usuario: se autentica con un token de dispositivo
 * propio (X-Player-Token), nunca con credenciales de persona. Ver
 * PlayerService para el flujo de emparejamiento.
 */
@Entity
@Table(name = "station_players")
@Getter
@Setter
@NoArgsConstructor
public class StationPlayer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String hostname;

    @Column(name = "pairing_id")
    private String pairingId;

    @Column(name = "pairing_code")
    private String pairingCode;

    @Column(name = "pairing_expires_at")
    private Instant pairingExpiresAt;

    @Column(name = "token_delivered", nullable = false)
    private boolean tokenDelivered = false;

    @Column(name = "device_token_hash")
    private String deviceTokenHash;

    /** A que estacion representa este puesto. Plano (no @ManyToOne), igual que sourceDeviceId en ScreenWidget. */
    @Column(name = "station_id")
    private Long stationId;

    /** Ultima version del Player (Electron) que reporto este puesto, para detectar Players desactualizados. */
    @Column(name = "player_version")
    private String playerVersion;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
