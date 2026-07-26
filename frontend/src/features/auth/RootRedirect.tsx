import * as React from "react";
import { Navigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/features/auth/auth-store";
import { isTokenValid } from "@/lib/jwt";

export function RootRedirect() {
  const token = useAuthStore((s) => s.token);
  const [target, setTarget] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiClient
      .get<{ completed: boolean }>("/api/wizard/state")
      .then(({ data }) => {
        if (!data.completed) {
          setTarget("/wizard");
        } else {
          setTarget(isTokenValid(token) ? "/dashboard" : "/login");
        }
      })
      .catch(() => setTarget("/wizard"));
  }, [token]);

  if (!target) {
    return <div className="flex h-svh items-center justify-center text-muted-foreground">...</div>;
  }

  return <Navigate to={target} replace />;
}
