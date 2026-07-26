package com.manufactoo.user.dto;

import com.manufactoo.user.User;

public record UserDto(
        Long id,
        String name,
        String email,
        String role,
        String language,
        String theme,
        String accentColor,
        boolean hasAvatar,
        Long avatarUpdatedAt
) {
    public static UserDto from(User user) {
        return new UserDto(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole().name(),
                user.getLanguage(),
                user.getTheme(),
                user.getAccentColor(),
                user.getAvatarImage() != null,
                user.getAvatarUpdatedAt() != null ? user.getAvatarUpdatedAt().toEpochMilli() : null
        );
    }
}
