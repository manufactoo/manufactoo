package com.manufactoo.company;

import com.manufactoo.common.Messages;
import com.manufactoo.company.dto.CompanySettingsDto;
import com.manufactoo.company.dto.UpdateCompanySettingsRequest;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.Instant;
import java.util.Set;

@RestController
@RequestMapping("/api/settings/company")
public class CompanySettingsController {

    private static final Set<String> ALLOWED_LOGO_TYPES = Set.of("image/png", "image/jpeg", "image/webp", "image/svg+xml");
    private static final long MAX_LOGO_BYTES = 2L * 1024 * 1024; // 2 MB

    private final CompanySettingsRepository repository;
    private final Messages messages;

    public CompanySettingsController(CompanySettingsRepository repository, Messages messages) {
        this.repository = repository;
        this.messages = messages;
    }

    @GetMapping
    public ResponseEntity<CompanySettingsDto> get() {
        return repository.findAll().stream().findFirst()
                .map(CompanySettingsDto::from)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping
    public CompanySettingsDto update(@Valid @RequestBody UpdateCompanySettingsRequest request) {
        CompanySettings settings = repository.findAll().stream().findFirst().orElseGet(CompanySettings::new);
        settings.setName(request.name());
        settings.setSector(request.sector());
        repository.save(settings);
        return CompanySettingsDto.from(settings);
    }

    @PostMapping(value = "/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CompanySettingsDto uploadLogo(@RequestParam("file") MultipartFile file) throws IOException {
        CompanySettings settings = repository.findAll().stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, messages.get("company.notSetUp")));

        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, messages.get("company.logo.empty"));
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_LOGO_TYPES.contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, messages.get("company.logo.unsupportedFormat"));
        }
        if (file.getSize() > MAX_LOGO_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, messages.get("company.logo.tooLarge"));
        }

        settings.setLogoImage(file.getBytes());
        settings.setLogoContentType(contentType);
        settings.setLogoUpdatedAt(Instant.now());
        repository.save(settings);
        return CompanySettingsDto.from(settings);
    }

    @DeleteMapping("/logo")
    public CompanySettingsDto deleteLogo() {
        CompanySettings settings = repository.findAll().stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, messages.get("company.notSetUp")));

        settings.setLogoImage(null);
        settings.setLogoContentType(null);
        settings.setLogoUpdatedAt(null);
        repository.save(settings);
        return CompanySettingsDto.from(settings);
    }

    @GetMapping("/logo")
    public ResponseEntity<byte[]> getLogo() {
        CompanySettings settings = repository.findAll().stream().findFirst().orElse(null);
        if (settings == null || settings.getLogoImage() == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(settings.getLogoContentType()))
                .cacheControl(CacheControl.noStore())
                .body(settings.getLogoImage());
    }
}
