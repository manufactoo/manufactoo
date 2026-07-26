package com.manufactoo.odoo.dto;

import com.manufactoo.odoo.OdooConnection;

import java.time.Instant;

/** Nunca incluye api_key_encrypted ni el secreto en claro. */
public record OdooConnectionDto(
        String host,
        Integer port,
        String database,
        String username,
        String odooVersion,
        String lastTestStatus,
        Instant lastTestAt,
        String lastTestError
) {
    public static OdooConnectionDto from(OdooConnection connection) {
        return new OdooConnectionDto(
                connection.getHost(),
                connection.getPort(),
                connection.getDatabase(),
                connection.getUsername(),
                connection.getOdooVersion(),
                connection.getLastTestStatus() != null ? connection.getLastTestStatus().name() : null,
                connection.getLastTestAt(),
                connection.getLastTestError()
        );
    }
}
