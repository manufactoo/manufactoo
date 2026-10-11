import { apiClient } from "@/lib/api-client";
import type { DataSourceTable } from "./types";

/**
 * Cache en memoria (por tipo+limite) de /api/stations/data-source-table,
 * compartida por todo lo que necesite las filas completas de un origen de
 * datos: el widget TABLE (sus propias filas) y la resolucion de Etiquetas
 * vinculadas a un DROPDOWN o TABLE (buscar la fila seleccionada para leer
 * una de sus columnas). Sin esta cache, cada consumidor pediria la misma
 * tabla por separado -- p. ej. una Etiqueta vinculada a la misma tabla que ya
 * esta en pantalla duplicaria la llamada.
 */
const cache = new Map<string, Promise<DataSourceTable>>();

/**
 * stationId opcional: si se pasa, filtra ordenes de fabricacion por las
 * rutas de esa estacion (config.filterByStationRoute de un TABLE, ver
 * WidgetView.tsx) o workorders por el Work Center de la estacion
 * (automatico para ODOO_WORKORDERS, sin casilla -- ver conversacion
 * 2026-08-04) -- clave de cache distinta (":route:<id>") para no
 * compartirla con una peticion sin filtrar del mismo tipo/limite, igual
 * criterio que optionsKeyFor en StationRuntimePage.tsx para el DROPDOWN.
 * operationId opcional: estrecha ODOO_WORKORDERS a una Operacion concreta
 * (config.operationId).
 */
export function fetchDataSourceTable(
  type: string,
  limit = 200,
  stationId?: string | number,
  operationId?: string | number,
): Promise<DataSourceTable> {
  const key = stationId || operationId
    ? `${type}:${limit}:route:${stationId ?? ""}:op:${operationId ?? ""}`
    : `${type}:${limit}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = apiClient
      .get<DataSourceTable>("/api/stations/data-source-table", {
        params: stationId || operationId ? { type, limit, stationId, operationId } : { type, limit },
      })
      .then(({ data }) => data);
    // Si la peticion falla, se quita de la cache para que el siguiente intento
    // (p. ej. otro widget del mismo tipo) pueda reintentarla en vez de quedar
    // atascado con una promesa rechazada para siempre.
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}

/** Busca una fila por id (tal cual la devuelve Odoo) dentro de una tabla ya cargada. */
export function findRowById(table: DataSourceTable | null, id: unknown): Record<string, unknown> | undefined {
  if (!table || id === null || id === undefined || id === "") return undefined;
  return table.rows.find((row) => String(row.id) === String(id));
}
