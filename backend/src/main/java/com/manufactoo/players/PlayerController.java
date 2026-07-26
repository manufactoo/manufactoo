package com.manufactoo.players;

import com.manufactoo.players.dto.AssignPlayerRequest;
import com.manufactoo.players.dto.HeartbeatRequest;
import com.manufactoo.players.dto.PairingStatusResponse;
import com.manufactoo.players.dto.PlayerDto;
import com.manufactoo.players.dto.PlayerMeDto;
import com.manufactoo.players.dto.RegisterPlayerRequest;
import com.manufactoo.players.dto.RegisterPlayerResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/players")
public class PlayerController {

    private final PlayerService service;

    public PlayerController(PlayerService service) {
        this.service = service;
    }

    // --- Publico: solo lo usa el propio Player durante el emparejamiento inicial ---

    @PostMapping("/register")
    public RegisterPlayerResponse register(@RequestBody(required = false) RegisterPlayerRequest request) {
        return service.register(request != null ? request : new RegisterPlayerRequest(null));
    }

    @GetMapping("/register/{pairingId}")
    public PairingStatusResponse pollPairing(@PathVariable String pairingId) {
        return service.pollPairing(pairingId);
    }

    // --- Administracion (sesion de usuario normal) ---

    @GetMapping
    public List<PlayerDto> list() {
        return service.list();
    }

    @PutMapping("/{id}")
    public PlayerDto assign(@PathVariable Long id, @RequestBody AssignPlayerRequest request) {
        return service.assign(id, request);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    // --- El propio Player, ya emparejado (cabecera X-Player-Token) ---

    @GetMapping("/me")
    public PlayerMeDto me(@AuthenticationPrincipal PlayerPrincipal principal) {
        return service.me(principal.player());
    }

    @PostMapping("/heartbeat")
    public void heartbeat(@AuthenticationPrincipal PlayerPrincipal principal, @RequestBody HeartbeatRequest request) {
        service.heartbeat(principal.player(), request);
    }
}
