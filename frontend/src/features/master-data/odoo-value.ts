/**
 * Los campos many2one de Odoo llegan como [id, "Nombre"] (o false si estan vacios).
 * Formatea cualquier valor devuelto por search_read para mostrarlo en la tabla.
 */
export function formatOdooValue(value: unknown): string {
  if (value === false || value === null || value === undefined) return "—";
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === "number") {
    return String(value[1]);
  }
  if (Array.isArray(value)) return value.map(formatOdooValue).join(", ");
  if (typeof value === "boolean") return value ? "✓" : "—";
  return String(value);
}
