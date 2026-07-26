package com.manufactoo.devices;

import com.manufactoo.apps.AppService;
import com.manufactoo.apps.TraceabilityGenealogyApp;
import com.manufactoo.devices.dto.DeviceDto;
import com.manufactoo.devices.dto.UpsertDeviceRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Service
public class DeviceService {

    private final DeviceRepository repository;
    private final AppService appService;

    public DeviceService(DeviceRepository repository, AppService appService) {
        this.repository = repository;
        this.appService = appService;
    }

    public List<DeviceDto> list() {
        requireAppInstalled();
        return repository.findAll().stream().map(DeviceDto::from).toList();
    }

    public DeviceDto get(Long id) {
        requireAppInstalled();
        return DeviceDto.from(find(id));
    }

    public DeviceDto create(UpsertDeviceRequest request) {
        requireAppInstalled();
        validate(request);

        Device device = new Device();
        applyRequest(device, request);
        repository.save(device);
        return DeviceDto.from(device);
    }

    public DeviceDto update(Long id, UpsertDeviceRequest request) {
        requireAppInstalled();
        validate(request);

        Device device = find(id);
        applyRequest(device, request);
        repository.save(device);
        return DeviceDto.from(device);
    }

    public void delete(Long id) {
        requireAppInstalled();
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Dispositivo no encontrado.");
        }
        repository.deleteById(id);
    }

    private Device find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dispositivo no encontrado."));
    }

    private void applyRequest(Device device, UpsertDeviceRequest request) {
        device.setName(request.name());
        device.setCategory(request.category());
        device.setDirection(request.direction());
        device.setTransport(request.transport());
        device.setEnabled(request.enabled());
        device.setConnection(request.connection() != null ? request.connection() : Map.of());
        device.setSettings(request.settings() != null ? request.settings() : Map.of());
    }

    private void validate(UpsertDeviceRequest request) {
        if (!DeviceCatalog.directionsFor(request.category()).contains(request.direction())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La categoria " + request.category() + " no admite direccion " + request.direction() + ".");
        }
        if (!DeviceCatalog.transportsFor(request.category()).contains(request.transport())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La categoria " + request.category() + " no admite el transporte " + request.transport() + ".");
        }

        List<String> missingConnection = missingRequiredFields(
                DeviceCatalog.connectionFieldsFor(request.category(), request.transport()), request.connection());
        if (!missingConnection.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Faltan datos de conexion: " + String.join(", ", missingConnection));
        }

        List<String> missingSettings = missingRequiredFields(
                DeviceCatalog.settingsFieldsFor(request.category()), request.settings());
        if (!missingSettings.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Faltan datos de configuracion: " + String.join(", ", missingSettings));
        }
    }

    private List<String> missingRequiredFields(List<DeviceFieldDef> fields, Map<String, Object> values) {
        return fields.stream()
                .filter(DeviceFieldDef::required)
                .filter(f -> values == null || values.get(f.key()) == null || values.get(f.key()).toString().isBlank())
                .map(DeviceFieldDef::key)
                .toList();
    }

    private void requireAppInstalled() {
        if (!appService.isInstalled(TraceabilityGenealogyApp.KEY)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Instala la app Trazabilidad y genealogia para gestionar dispositivos.");
        }
    }
}
