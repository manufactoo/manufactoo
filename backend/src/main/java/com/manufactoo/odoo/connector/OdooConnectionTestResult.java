package com.manufactoo.odoo.connector;

public record OdooConnectionTestResult(
        boolean success,
        String odooVersion,
        Integer authenticatedUid,
        String errorMessage
) {
    public static OdooConnectionTestResult success(String odooVersion, int uid) {
        return new OdooConnectionTestResult(true, odooVersion, uid, null);
    }

    public static OdooConnectionTestResult failure(String odooVersion, String errorMessage) {
        return new OdooConnectionTestResult(false, odooVersion, null, errorMessage);
    }
}
