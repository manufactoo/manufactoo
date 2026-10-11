package com.manufactoo.stations.dto;

/** operatorCode es opcional: el codigo de barras escaneado del operario (se resuelve contra ODOO_OPERATORS). */
public record StartWorkOrderSessionRequest(Long odooWorkorderId, Long odooWorkcenterId, String operatorCode) {
}
