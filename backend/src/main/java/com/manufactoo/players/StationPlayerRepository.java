package com.manufactoo.players;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StationPlayerRepository extends JpaRepository<StationPlayer, Long> {
    Optional<StationPlayer> findByPairingId(String pairingId);

    Optional<StationPlayer> findByDeviceTokenHash(String deviceTokenHash);
}
