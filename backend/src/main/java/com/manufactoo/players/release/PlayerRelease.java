package com.manufactoo.players.release;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Un instalador del Manufactoo Player subido por un administrador, servido despues via el feed de electron-updater. */
@Entity
@Table(name = "player_releases")
@Getter
@Setter
@NoArgsConstructor
public class PlayerRelease {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String version;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PlayerReleasePlatform platform;

    @Column(nullable = false)
    private String filename;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(nullable = false)
    private byte[] data;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "sha512_base64", nullable = false)
    private String sha512Base64;

    @Column(name = "release_notes", columnDefinition = "text")
    private String releaseNotes;

    @Column(name = "published_at", nullable = false)
    private Instant publishedAt = Instant.now();
}
