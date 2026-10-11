import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/features/auth/auth-store";
import { OpenOrdersChart } from "./OpenOrdersChart";

export function DashboardHome() {
  const { t } = useTranslation("dashboard");
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("welcome")}</h1>
        <p className="text-muted-foreground">{user?.name}</p>
      </div>
      <div className="max-w-2xl">
        <OpenOrdersChart />
      </div>
    </div>
  );
}
