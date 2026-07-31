package com.manufactoo.common;

import com.manufactoo.wizard.WizardAlreadyCompletedException;
import com.manufactoo.wizard.WizardResetNotAllowedException;
import com.manufactoo.wizard.WizardValidationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final Messages messages;

    public GlobalExceptionHandler(Messages messages) {
        this.messages = messages;
    }

    @ExceptionHandler(WizardAlreadyCompletedException.class)
    public ResponseEntity<Map<String, String>> handle(WizardAlreadyCompletedException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", messages.get("wizard.alreadyCompleted")));
    }

    @ExceptionHandler(WizardValidationException.class)
    public ResponseEntity<Map<String, String>> handle(WizardValidationException e) {
        // El mensaje ya viene traducido desde WizardService (usa Messages alli, no aqui):
        // esta excepcion es de las pocas que lleva un mensaje realmente dinamico,
        // no una clave fija.
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(WizardResetNotAllowedException.class)
    public ResponseEntity<Map<String, String>> handle(WizardResetNotAllowedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", messages.get("wizard.resetNotAllowed")));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handle(MethodArgumentNotValidException e) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().forEach(fe ->
                fieldErrors.put(fe.getField(), fe.getDefaultMessage()));
        return ResponseEntity.badRequest().body(fieldErrors);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handle(MaxUploadSizeExceededException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", messages.get("common.fileTooLarge")));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handle(ResponseStatusException e) {
        String message = e.getReason() != null ? e.getReason() : e.getMessage();
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", message));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handle(IllegalStateException e) {
        log.error("Error interno", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", messages.get("common.internalError")));
    }
}
