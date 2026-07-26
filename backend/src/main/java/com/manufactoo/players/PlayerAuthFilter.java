package com.manufactoo.players;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Autentica peticiones del Manufactoo Player via la cabecera X-Player-Token
 * (nunca via JWT de usuario: un Player es un dispositivo, no una persona).
 * Convive con JwtAuthFilter en la misma cadena; cada uno solo actua sobre su
 * propia cabecera, asi que no interfieren entre si.
 */
@Component
public class PlayerAuthFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Player-Token";

    private final StationPlayerRepository repository;

    public PlayerAuthFilter(StationPlayerRepository repository) {
        this.repository = repository;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {
        String token = request.getHeader(HEADER);

        if (token != null && !token.isBlank() && SecurityContextHolder.getContext().getAuthentication() == null) {
            repository.findByDeviceTokenHash(PlayerTokenHasher.sha256Hex(token)).ifPresent(player -> {
                var authToken = new UsernamePasswordAuthenticationToken(
                        new PlayerPrincipal(player), null, List.of(new SimpleGrantedAuthority("ROLE_PLAYER")));
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            });
        }

        filterChain.doFilter(request, response);
    }
}
