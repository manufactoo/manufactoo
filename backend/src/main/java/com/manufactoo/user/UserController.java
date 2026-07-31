package com.manufactoo.user;

import com.manufactoo.common.Messages;
import com.manufactoo.user.dto.UpdatePreferencesRequest;
import com.manufactoo.user.dto.UpdateProfileRequest;
import com.manufactoo.user.dto.UserDto;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.Instant;
import java.util.Set;

@RestController
@RequestMapping("/api/users/me")
public class UserController {

    private static final Set<String> ALLOWED_AVATAR_TYPES = Set.of("image/png", "image/jpeg", "image/webp");
    private static final long MAX_AVATAR_BYTES = 2L * 1024 * 1024; // 2 MB

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final Messages messages;

    public UserController(UserRepository userRepository, PasswordEncoder passwordEncoder, Messages messages) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.messages = messages;
    }

    @GetMapping
    public UserDto get(@AuthenticationPrincipal User user) {
        return UserDto.from(user);
    }

    @PutMapping
    public UserDto update(@AuthenticationPrincipal User user, @Valid @RequestBody UpdateProfileRequest request) {
        if (!user.getEmail().equalsIgnoreCase(request.email()) && userRepository.existsByEmail(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, messages.get("user.emailInUse"));
        }

        user.setName(request.name());
        user.setEmail(request.email());

        if (request.newPassword() != null && !request.newPassword().isBlank()) {
            if (request.currentPassword() == null || !passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, messages.get("user.wrongCurrentPassword"));
            }
            if (request.newPassword().length() < 8) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, messages.get("user.newPasswordTooShort"));
            }
            user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        }

        userRepository.save(user);
        return UserDto.from(user);
    }

    @PutMapping("/preferences")
    public UserDto updatePreferences(@AuthenticationPrincipal User user, @Valid @RequestBody UpdatePreferencesRequest request) {
        user.setLanguage(request.language());
        user.setTheme(request.theme());
        user.setAccentColor(request.accentColor());
        userRepository.save(user);
        return UserDto.from(user);
    }

    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UserDto uploadAvatar(@AuthenticationPrincipal User user, @RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, messages.get("user.avatar.empty"));
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_AVATAR_TYPES.contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, messages.get("user.avatar.unsupportedFormat"));
        }
        if (file.getSize() > MAX_AVATAR_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, messages.get("user.avatar.tooLarge"));
        }

        user.setAvatarImage(file.getBytes());
        user.setAvatarContentType(contentType);
        user.setAvatarUpdatedAt(Instant.now());
        userRepository.save(user);
        return UserDto.from(user);
    }

    @DeleteMapping("/avatar")
    public UserDto deleteAvatar(@AuthenticationPrincipal User user) {
        user.setAvatarImage(null);
        user.setAvatarContentType(null);
        user.setAvatarUpdatedAt(null);
        userRepository.save(user);
        return UserDto.from(user);
    }

    @GetMapping("/avatar")
    public ResponseEntity<byte[]> getAvatar(@AuthenticationPrincipal User user) {
        if (user.getAvatarImage() == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(user.getAvatarContentType()))
                .cacheControl(CacheControl.noStore())
                .body(user.getAvatarImage());
    }
}
