package com.manufactoo.devices;

import com.manufactoo.devices.dto.DeviceCatalogDto;
import com.manufactoo.devices.dto.DeviceDto;
import com.manufactoo.devices.dto.UpsertDeviceRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/devices")
public class DeviceController {

    private final DeviceService service;

    public DeviceController(DeviceService service) {
        this.service = service;
    }

    @GetMapping("/catalog")
    public DeviceCatalogDto catalog() {
        List<DeviceCatalogDto.CategoryEntry> categories = Arrays.stream(DeviceCatalog.allCategories())
                .map(category -> new DeviceCatalogDto.CategoryEntry(
                        category.name(),
                        DeviceCatalog.defaultDirectionFor(category).name(),
                        DeviceCatalog.directionsFor(category).stream().map(Enum::name).toList(),
                        DeviceCatalog.transportsFor(category).stream()
                                .map(transport -> new DeviceCatalogDto.TransportOption(
                                        transport.name(),
                                        DeviceCatalog.connectionFieldsFor(category, transport)))
                                .toList(),
                        DeviceCatalog.settingsFieldsFor(category)
                ))
                .toList();

        return new DeviceCatalogDto(categories);
    }

    @GetMapping
    public List<DeviceDto> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    public DeviceDto get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    public DeviceDto create(@Valid @RequestBody UpsertDeviceRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public DeviceDto update(@PathVariable Long id, @Valid @RequestBody UpsertDeviceRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
