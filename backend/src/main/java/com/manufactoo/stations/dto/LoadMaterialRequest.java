package com.manufactoo.stations.dto;

/**
 * Carga un lote/serie en la estacion: code es el codigo a validar contra
 * series/lotes de Odoo. position es opcional -- si se indica y esa posicion
 * ya tenia algo cargado, lo sustituye (cierra lo anterior); si no, este
 * material simplemente se añade sin sustituir nada.
 */
public record LoadMaterialRequest(String code, String position) {
}
