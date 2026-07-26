package com.manufactoo.players.release;

import com.manufactoo.players.release.dto.PlayerReleaseDto;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/player-releases")
public class PlayerReleaseController {

    private final PlayerReleaseService service;

    public PlayerReleaseController(PlayerReleaseService service) {
        this.service = service;
    }

    /** Listado para el panel de administracion (sesion de usuario). */
    @GetMapping
    public List<PlayerReleaseDto> list() {
        return service.list();
    }

    /** Publicar una nueva version del Player (sesion de usuario). */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PlayerReleaseDto upload(@RequestParam("file") MultipartFile file,
                                    @RequestParam @NotNull String version,
                                    @RequestParam @NotNull PlayerReleasePlatform platform,
                                    @RequestParam(required = false) String releaseNotes) {
        return service.upload(file, version, platform, releaseNotes);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    // --- Publico: lo consume electron-updater directamente, sin autenticacion ---

    @GetMapping(value = "/latest.yml", produces = "text/yaml")
    public String latestWindows() {
        return service.latestManifest(PlayerReleasePlatform.WINDOWS);
    }

    @GetMapping(value = "/latest-mac.yml", produces = "text/yaml")
    public String latestMac() {
        return service.latestManifest(PlayerReleasePlatform.MAC);
    }

    @GetMapping(value = "/latest-linux.yml", produces = "text/yaml")
    public String latestLinux() {
        return service.latestManifest(PlayerReleasePlatform.LINUX);
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable Long id) {
        PlayerRelease release = service.download(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(release.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + release.getFilename() + "\"")
                .body(release.getData());
    }
}
