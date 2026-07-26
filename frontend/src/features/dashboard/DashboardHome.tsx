import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/features/auth/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DashboardHome() {
  const { t } = useTranslation("dashboard");
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("welcome")}</h1>
        <p className="text-muted-foreground">{user?.name}</p>
      </div>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Manufactoo</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          El station builder, la gestion de rutas y la ejecucion en planta llegaran en proximas fases. Por ahora
          puedes revisar y editar la configuracion de tu instalacion.
        </CardContent>
      </Card>
    </div>
  );
}
