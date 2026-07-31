import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/auth-store";
import { isTokenValid } from "@/lib/jwt";
import { getBridge } from "@/features/stations/manufactoo-bridge";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  // Dentro del Manufactoo Player no hay ningun usuario logueado: el Player se
  // autentica con su propio token de dispositivo (X-Player-Token), no con un
  // JWT de usuario. El preload inyecta window.manufactoo de forma sincrona
  // antes de que esta pagina cargue (ver preload/index.js), asi que la
  // comprobacion nunca llega tarde.
  if (getBridge()) {
    return <>{children}</>;
  }

  if (!isTokenValid(token)) {
    if (token) logout();
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
