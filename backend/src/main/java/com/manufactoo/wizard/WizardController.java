package com.manufactoo.wizard;

import com.manufactoo.odoo.dto.OdooTestConnectionRequest;
import com.manufactoo.odoo.dto.OdooTestConnectionResponse;
import com.manufactoo.wizard.dto.WizardCompleteRequest;
import com.manufactoo.wizard.dto.WizardCompleteResponse;
import com.manufactoo.wizard.dto.WizardStateResponse;
import com.manufactoo.wizard.dto.WizardStateSaveRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/wizard")
public class WizardController {

    private final WizardService wizardService;

    public WizardController(WizardService wizardService) {
        this.wizardService = wizardService;
    }

    @GetMapping("/state")
    public WizardStateResponse getState() {
        return wizardService.getState();
    }

    @PostMapping("/state")
    public WizardStateResponse saveState(@Valid @RequestBody WizardStateSaveRequest request) {
        return wizardService.saveState(request);
    }

    /** Solo habilitado si manufactoo.wizard.allow-reset=true (perfil dev). */
    @PostMapping("/reset")
    public ResponseEntity<Void> reset() {
        wizardService.reset();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/odoo/test-connection")
    public OdooTestConnectionResponse testConnection(@Valid @RequestBody OdooTestConnectionRequest request) {
        return wizardService.testConnection(request);
    }

    @PostMapping("/complete")
    public WizardCompleteResponse complete(@Valid @RequestBody WizardCompleteRequest request) {
        return wizardService.complete(request);
    }
}
