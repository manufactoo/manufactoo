package com.manufactoo.players;

import com.manufactoo.common.Messages;
import com.manufactoo.players.dto.AssignPlayerRequest;
import com.manufactoo.players.dto.HeartbeatRequest;
import com.manufactoo.players.dto.PairingStatusResponse;
import com.manufactoo.players.dto.PlayerDto;
import com.manufactoo.players.dto.PlayerMeDto;
import com.manufactoo.players.dto.RegisterPlayerRequest;
import com.manufactoo.players.dto.RegisterPlayerResponse;
import com.manufactoo.stations.Station;
import com.manufactoo.stations.StationRepository;
import com.manufactoo.stations.dto.StationDto;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Flujo de emparejamiento del Manufactoo Player, inspirado en el "device code
 * flow" que usan smart TVs/consolas: el Player nunca maneja credenciales de
 * usuario, solo un codigo efimero (mostrado en pantalla, sondeado por el
 * propio Player) que un administrador resuelve asignandolo a una estacion
 * desde el panel web. El token de dispositivo resultante se entrega una unica
 * vez y a partir de ahi identifica al Player para siempre (hasta que se
 * desempareja).
 */
@Service
public class PlayerService {

    private static final Duration PAIRING_TTL = Duration.ofMinutes(15);

    private final StationPlayerRepository repository;
    private final StationRepository stationRepository;
    private final Messages messages;

    public PlayerService(StationPlayerRepository repository, StationRepository stationRepository, Messages messages) {
        this.repository = repository;
        this.stationRepository = stationRepository;
        this.messages = messages;
    }

    public RegisterPlayerResponse register(RegisterPlayerRequest request) {
        StationPlayer player = new StationPlayer();
        String hostname = request.hostname();
        player.setName(hostname != null && !hostname.isBlank() ? hostname : "Nuevo Player");
        player.setHostname(hostname);
        player.setPairingId(PlayerTokenHasher.randomUrlSafeToken(24));
        player.setPairingCode(PlayerTokenHasher.randomPairingCode());
        player.setPairingExpiresAt(Instant.now().plus(PAIRING_TTL));
        repository.save(player);
        return new RegisterPlayerResponse(player.getPairingId(), player.getPairingCode(), PAIRING_TTL.toSeconds());
    }

    public PairingStatusResponse pollPairing(String pairingId) {
        StationPlayer player = repository.findByPairingId(pairingId).orElse(null);
        if (player == null) {
            return PairingStatusResponse.notFound();
        }
        if (player.getStationId() == null) {
            if (player.getPairingExpiresAt() != null && player.getPairingExpiresAt().isBefore(Instant.now())) {
                return PairingStatusResponse.expired();
            }
            return PairingStatusResponse.pending();
        }
        if (player.isTokenDelivered()) {
            // El token solo se entrega una vez; si se perdio, hay que desemparejar y empezar de nuevo.
            return PairingStatusResponse.alreadyDelivered();
        }
        String rawToken = PlayerTokenHasher.randomUrlSafeToken(32);
        player.setDeviceTokenHash(PlayerTokenHasher.sha256Hex(rawToken));
        player.setTokenDelivered(true);
        player.setPairingId(null);
        repository.save(player);
        return PairingStatusResponse.paired(rawToken, player.getStationId());
    }

    public List<PlayerDto> list() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    public PlayerDto assign(Long id, AssignPlayerRequest request) {
        StationPlayer player = find(id);
        if (request.stationId() != null && !stationRepository.existsById(request.stationId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, messages.get("station.notFound"));
        }
        if (request.name() != null && !request.name().isBlank()) {
            player.setName(request.name());
        }
        player.setStationId(request.stationId());
        repository.save(player);
        return toDto(player);
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, messages.get("player.notFound"));
        }
        repository.deleteById(id);
    }

    // --- Lado Player (autenticado por token, ver PlayerAuthFilter) ---

    @Transactional
    public PlayerMeDto me(StationPlayer player) {
        if (player.getStationId() == null) {
            return new PlayerMeDto(null, null);
        }
        StationDto station = stationRepository.findById(player.getStationId())
                .map(StationDto::from)
                .orElse(null);
        return new PlayerMeDto(player.getStationId(), station);
    }

    public void heartbeat(StationPlayer player, HeartbeatRequest request) {
        player.setPlayerVersion(request.playerVersion());
        player.setLastSeenAt(Instant.now());
        repository.save(player);
    }

    private StationPlayer find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, messages.get("player.notFound")));
    }

    private PlayerDto toDto(StationPlayer player) {
        String stationName = player.getStationId() != null
                ? stationRepository.findById(player.getStationId()).map(Station::getName).orElse(null)
                : null;
        boolean pending = player.getStationId() == null
                && player.getPairingExpiresAt() != null
                && player.getPairingExpiresAt().isAfter(Instant.now());
        return new PlayerDto(
                player.getId(),
                player.getName(),
                player.getHostname(),
                player.getStationId(),
                stationName,
                player.getPlayerVersion(),
                player.getLastSeenAt(),
                pending,
                pending ? player.getPairingCode() : null,
                player.isTokenDelivered()
        );
    }
}
