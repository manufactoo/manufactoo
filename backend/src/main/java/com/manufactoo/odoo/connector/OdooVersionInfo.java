package com.manufactoo.odoo.connector;

/** Resultado de common.version() contra una instancia Odoo. */
public record OdooVersionInfo(String serverVersion, String serverSerie, int majorVersion) {
}
