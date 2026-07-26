package com.manufactoo.players.release;

import com.manufactoo.players.release.dto.PlayerReleaseDto;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Aloja el feed de actualizacion del Manufactoo Player para electron-updater
 * (provider "generic"), dentro del propio servidor Manufactoo: nada sale a
 * internet, y una empresa on-premise puede actualizar sus Players igual que
 * actualiza el propio MES. Un administrador sube el instalador de una nueva
 * version; el Player, via electron-updater, comprueba periodicamente
 * GET /api/player-releases/latest*.yml y descarga si hay version mas nueva.
 */
@Service
public class PlayerReleaseService {

    private static final Pattern SEMVER = Pattern.compile("^\\d+\\.\\d+\\.\\d+$");
    private static final DateTimeFormatter ISO_MILLIS = DateTimeFormatter.ISO_INSTANT;

    private final PlayerReleaseRepository repository;

    public PlayerReleaseService(PlayerReleaseRepository repository) {
        this.repository = repository;
    }

    public List<PlayerReleaseDto> list() {
        return repository.findAllByOrderByPublishedAtDesc().stream().map(PlayerReleaseDto::from).toList();
    }

    public PlayerReleaseDto upload(MultipartFile file, String version, PlayerReleasePlatform platform, String releaseNotes) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El fichero esta vacio.");
        }
        if (version == null || !SEMVER.matcher(version).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La version debe tener formato semver, p. ej. 1.2.3.");
        }
        if (platform == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Falta la plataforma (WINDOWS/MAC/LINUX).");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No se pudo leer el fichero.");
        }

        PlayerRelease release = new PlayerRelease();
        release.setVersion(version);
        release.setPlatform(platform);
        release.setFilename(file.getOriginalFilename() != null ? file.getOriginalFilename() : "manufactoo-player-installer");
        release.setContentType(file.getContentType() != null ? file.getContentType() : "application/octet-stream");
        release.setData(bytes);
        release.setSizeBytes(bytes.length);
        release.setSha512Base64(sha512Base64(bytes));
        release.setReleaseNotes(releaseNotes);
        repository.save(release);
        return PlayerReleaseDto.from(release);
    }

    public PlayerRelease download(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Version no encontrada."));
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Version no encontrada.");
        }
        repository.deleteById(id);
    }

    /** Manifiesto YAML del canal "generic" de electron-updater para una plataforma, o 404 si no hay ninguna version publicada. */
    public String latestManifest(PlayerReleasePlatform platform) {
        PlayerRelease latest = repository.findFirstByPlatformOrderByPublishedAtDesc(platform)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Todavia no se ha publicado ninguna version del Player para " + platform + "."));

        String downloadPath = latest.getId() + "/download";
        String releaseDate = ISO_MILLIS.format(latest.getPublishedAt());

        StringBuilder yaml = new StringBuilder();
        yaml.append("version: ").append(latest.getVersion()).append('\n');
        yaml.append("files:\n");
        yaml.append("  - url: ").append(downloadPath).append('\n');
        yaml.append("    sha512: ").append(latest.getSha512Base64()).append('\n');
        yaml.append("    size: ").append(latest.getSizeBytes()).append('\n');
        yaml.append("path: ").append(downloadPath).append('\n');
        yaml.append("sha512: ").append(latest.getSha512Base64()).append('\n');
        yaml.append("releaseDate: '").append(releaseDate).append("'\n");
        if (latest.getReleaseNotes() != null && !latest.getReleaseNotes().isBlank()) {
            yaml.append("releaseNotes: ").append(yamlQuote(latest.getReleaseNotes())).append('\n');
        }
        return yaml.toString();
    }

    private static String yamlQuote(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
    }

    private static String sha512Base64(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-512");
            return Base64.getEncoder().encodeToString(digest.digest(data));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
