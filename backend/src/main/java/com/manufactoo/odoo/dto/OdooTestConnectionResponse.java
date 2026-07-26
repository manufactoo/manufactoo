package com.manufactoo.odoo.dto;

import com.manufactoo.odoo.connector.OdooConnectionTestResult;

public record OdooTestConnectionResponse(boolean success, String odooVersion, String errorMessage) {
    public static OdooTestConnectionResponse from(OdooConnectionTestResult result) {
        return new OdooTestConnectionResponse(result.success(), result.odooVersion(), result.errorMessage());
    }
}
