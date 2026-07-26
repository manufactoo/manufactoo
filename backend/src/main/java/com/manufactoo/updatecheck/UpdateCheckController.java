package com.manufactoo.updatecheck;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings/update-check")
public class UpdateCheckController {

    private final UpdateCheckService service;

    public UpdateCheckController(UpdateCheckService service) {
        this.service = service;
    }

    @GetMapping
    public UpdateCheckService.UpdateCheckResult check() {
        return service.check();
    }
}
