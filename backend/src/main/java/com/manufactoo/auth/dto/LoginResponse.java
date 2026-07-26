package com.manufactoo.auth.dto;

import com.manufactoo.user.dto.UserDto;

public record LoginResponse(String token, UserDto user) {
}
