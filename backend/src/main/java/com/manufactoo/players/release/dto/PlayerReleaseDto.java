package com.manufactoo.players.release.dto;

import com.manufactoo.players.release.PlayerRelease;

import java.time.Instant;

public record PlayerReleaseDto(
        Long id,
        String version,
        String platform,
        String filename,
        long sizeBytes,
        String releaseNotes,
        Instant publishedAt
) {
    public static PlayerReleaseDto from(PlayerRelease r) {
        return new PlayerReleaseDto(r.getId(), r.getVersion(), r.getPlatform().name(), r.getFilename(),
                r.getSizeBytes(), r.getReleaseNotes(), r.getPublishedAt());
    }
}
