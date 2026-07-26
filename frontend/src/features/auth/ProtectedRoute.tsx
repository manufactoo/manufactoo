import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/auth-store";
import { isTokenValid } from "@/lib/jwt";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  if (!isTokenValid(token)) {
    if (token) logout();
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
