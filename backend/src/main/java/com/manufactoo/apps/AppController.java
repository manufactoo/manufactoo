package com.manufactoo.apps;

import com.manufactoo.apps.dto.AppDto;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/apps")
public class AppController {

    private final AppService appService;

    public AppController(AppService appService) {
        this.appService = appService;
    }

    @GetMapping
    public List<AppDto> list() {
        return appService.listApps();
    }

    @PostMapping("/{key}/install")
    public AppDto install(@PathVariable String key) {
        return appService.install(key);
    }

    @PostMapping("/{key}/uninstall")
    public AppDto uninstall(@PathVariable String key) {
        return appService.uninstall(key);
    }
}
