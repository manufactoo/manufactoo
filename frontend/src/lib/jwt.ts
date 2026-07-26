/** Decodifica el payload de un JWT y comprueba que no haya caducado. No verifica la firma (eso lo hace el backend en cada peticion); solo evita mostrar la app como "logueado" con un token caducado o corrupto. */
export function isTokenValid(token: string | null | undefined): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
