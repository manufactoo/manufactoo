package com.manufactoo.wizard;

import com.manufactoo.common.Messages;
import com.manufactoo.company.CompanySettings;
import com.manufactoo.company.CompanySettingsRepository;
import com.manufactoo.company.dto.CompanySettingsDto;
import com.manufactoo.config.WizardProperties;
import com.manufactoo.crypto.CryptoService;
import com.manufactoo.odoo.OdooConnection;
import com.manufactoo.odoo.OdooConnectionRepository;
import com.manufactoo.odoo.OdooConnectionService;
import com.manufactoo.odoo.OdooTestStatus;
import com.manufactoo.odoo.connector.OdooConnectionTestResult;
import com.manufactoo.odoo.dto.OdooConnectionDto;
import com.manufactoo.odoo.dto.OdooTestConnectionRequest;
import com.manufactoo.odoo.dto.OdooTestConnectionResponse;
import com.manufactoo.security.JwtService;
import com.manufactoo.user.User;
import com.manufactoo.user.UserRepository;
import com.manufactoo.user.dto.UserDto;
import com.manufactoo.wizard.dto.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Set;

@Service
public class WizardService {

    /** Nunca se persiste en installation_wizard_state.payload_json entre pasos: hay que retipearlos al reanudar. */
    private static final Set<String> SENSITIVE_PAYLOAD_KEYS = Set.of(
            "adminPassword", "adminPasswordConfirm", "odooApiKeyOrPassword");

    private final InstallationWizardStateRepository wizardStateRepository;
    private final UserRepository userRepository;
    private final CompanySettingsRepository companySettingsRepository;
    private final OdooConnectionRepository odooConnectionRepository;
    private final OdooConnectionService odooConnectionService;
    private final CryptoService cryptoService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final WizardProperties wizardProperties;
    private final Messages messages;

    public WizardService(InstallationWizardStateRepository wizardStateRepository,
                           UserRepository userRepository,
                           CompanySettingsRepository companySettingsRepository,
                           OdooConnectionRepository odooConnectionRepository,
                           OdooConnectionService odooConnectionService,
                           CryptoService cryptoService,
                           PasswordEncoder passwordEncoder,
                           JwtService jwtService,
                           WizardProperties wizardProperties,
                           Messages messages) {
        this.wizardStateRepository = wizardStateRepository;
        this.userRepository = userRepository;
        this.companySettingsRepository = companySettingsRepository;
        this.odooConnectionRepository = odooConnectionRepository;
        this.odooConnectionService = odooConnectionService;
        this.cryptoService = cryptoService;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.wizardProperties = wizardProperties;
        this.messages = messages;
    }

    public WizardStateResponse getState() {
        boolean completed = companySettingsRepository.count() > 0;
        InstallationWizardState state = wizardStateRepository.findAll().stream().findFirst().orElse(null);
        if (state == null) {
            return new WizardStateResponse(1, java.util.Map.of(), completed);
        }
        return new WizardStateResponse(state.getCurrentStep(), state.getPayload(), completed);
    }

    @Transactional
    public WizardStateResponse saveState(WizardStateSaveRequest request) {
        if (companySettingsRepository.count() > 0) {
            throw new WizardAlreadyCompletedException();
        }

        InstallationWizardState state = wizardStateRepository.findAll().stream().findFirst()
                .orElseGet(InstallationWizardState::new);

        state.setCurrentStep(request.currentStep());
        var sanitized = new java.util.LinkedHashMap<String, Object>(
                request.payload() == null ? java.util.Map.of() : request.payload());
        SENSITIVE_PAYLOAD_KEYS.forEach(sanitized::remove);
        state.setPayload(sanitized);

        wizardStateRepository.save(state);
        return new WizardStateResponse(state.getCurrentStep(), state.getPayload(), false);
    }

    @Transactional
    public void reset() {
        if (!wizardProperties.allowReset()) {
            throw new WizardResetNotAllowedException();
        }
        wizardStateRepository.deleteAll();
        odooConnectionRepository.deleteAll();
        companySettingsRepository.deleteAll();
        userRepository.deleteAll();
    }

    public OdooTestConnectionResponse testConnection(OdooTestConnectionRequest request) {
        OdooConnectionTestResult result = odooConnectionService.testConnection(
                request.host(), request.port(), request.database(), request.username(), request.apiKeyOrPassword());
        return OdooTestConnectionResponse.from(result);
    }

    @Transactional
    public WizardCompleteResponse complete(WizardCompleteRequest request) {
        if (companySettingsRepository.count() > 0) {
            throw new WizardAlreadyCompletedException();
        }

        var external = request.external();

        OdooConnectionTestResult test = odooConnectionService.testConnection(
                external.host(), external.port(), external.database(), external.username(), external.apiKeyOrPassword());

        if (!test.success()) {
            throw new WizardValidationException(
                    test.errorMessage() != null ? test.errorMessage() : messages.get("wizard.odooValidationFailed"));
        }

        String detectedMajor = test.odooVersion() == null ? "" : test.odooVersion().replace(".0", "");
        String expectedMajor = String.valueOf(request.odooVersion());
        if (!detectedMajor.equals(expectedMajor)) {
            throw new WizardValidationException(
                    messages.get("wizard.odooVersionMismatch", test.odooVersion(), request.odooVersion()));
        }

        User admin = new User();
        admin.setName(request.admin().fullName());
        admin.setEmail(request.admin().email());
        admin.setPasswordHash(passwordEncoder.encode(request.admin().password()));
        admin.setLanguage(request.language());
        userRepository.save(admin);

        CompanySettings company = new CompanySettings();
        company.setName(request.companyName());
        company.setSector(request.companySector());
        companySettingsRepository.save(company);

        OdooConnection connection = new OdooConnection();
        connection.setHost(external.host());
        connection.setPort(external.port());
        connection.setDatabase(external.database());
        connection.setUsername(external.username());
        connection.setApiKeyEncrypted(cryptoService.encrypt(external.apiKeyOrPassword()));
        connection.setOdooVersion(test.odooVersion());
        connection.setLastTestStatus(OdooTestStatus.SUCCESS);
        connection.setLastTestAt(Instant.now());
        odooConnectionRepository.save(connection);

        InstallationWizardState state = wizardStateRepository.findAll().stream().findFirst()
                .orElseGet(InstallationWizardState::new);
        state.setCurrentStep(5);
        state.setPayload(java.util.Map.of());
        state.setCompletedAt(Instant.now());
        wizardStateRepository.save(state);

        String token = jwtService.generateToken(admin.getId(), admin.getEmail());

        return new WizardCompleteResponse(
                true,
                "/dashboard",
                token,
                UserDto.from(admin),
                CompanySettingsDto.from(company),
                OdooConnectionDto.from(connection)
        );
    }
}
