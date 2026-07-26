package com.manufactoo.odoo.connector;

/** Fallo de red, timeout o error devuelto por el endpoint /jsonrpc de Odoo. */
public class OdooJsonRpcException extends RuntimeException {
    public OdooJsonRpcException(String message) {
        super(message);
    }

    public OdooJsonRpcException(String message, Throwable cause) {
        super(message, cause);
    }
}
