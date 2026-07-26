import { apiClient } from "@/lib/api-client";

export interface OdooTestConnectionRequest {
  host: string;
  port: number;
  database: string;
  username: string;
  apiKeyOrPassword: string;
}

export interface OdooTestConnectionResponse {
  success: boolean;
  odooVersion: string | null;
  errorMessage: string | null;
}

/** Usado tanto por el wizard (paso 2) como por Configuracion > Conexion Odoo. */
export async function testOdooConnection(
  payload: OdooTestConnectionRequest,
  context: "wizard" | "settings" = "wizard",
): Promise<OdooTestConnectionResponse> {
  const url =
    context === "wizard"
      ? "/api/wizard/odoo/test-connection"
      : "/api/settings/odoo-connection/test";
  const { data } = await apiClient.post<OdooTestConnectionResponse>(url, payload);
  return data;
}
