package com.manufactoo.players.release;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlayerReleaseRepository extends JpaRepository<PlayerRelease, Long> {
    Optional<PlayerRelease> findFirstByPlatformOrderByPublishedAtDesc(PlayerReleasePlatform platform);

    List<PlayerRelease> findAllByOrderByPublishedAtDesc();
}
