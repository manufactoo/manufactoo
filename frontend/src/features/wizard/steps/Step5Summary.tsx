import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { useWizardStore } from "@/features/wizard/wizard-state";
import { useAuthStore } from "@/features/auth/auth-store";
import { StepFooter } from "@/features/wizard/StepFooter";
import { SUPPORTED_LANGUAGES } from "@/i18n";

export function Step5Summary() {
  const { t } = useTranslation("wizard");
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const wizard = useWizardStore();
  const back = useWizardStore((s) => s.back);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const languageLabel = SUPPORTED_LANGUAGES.find((l) => l.code === wizard.language)?.nativeName ?? wizard.language;

  async function handleFinish() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.post("/api/wizard/complete", {
        language: wizard.language,
        external: wizard.external,
        companyName: wizard.companyName,
        companySector: wizard.companySector || null,
        admin: {
          fullName: wizard.admin.fullName,
          email: wizard.admin.email,
          password: wizard.admin.password,
        },
      });

      setSession(data.token, data.user);
      navigate(data.redirectTo ?? "/dashboard");
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Error desconocido";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t("step5.title")}</h1>
      <p className="mt-1 text-muted-foreground">{t("step5.subtitle")}</p>

      <dl className="mt-6 space-y-3 text-sm">
        <div className="flex justify-between border-b pb-2">
          <dt className="text-muted-foreground">{t("step5.language")}</dt>
          <dd className="font-medium">{languageLabel}</dd>
        </div>
        <div className="flex justify-between border-b pb-2">
          <dt className="text-muted-foreground">{t("step5.odooStatus")}</dt>
          <dd className="font-medium">
            {t("step5.odooConnected", { version: wizard.odooTestResult?.odooVersion ?? "?" })}
          </dd>
        </div>
        <div className="flex justify-between border-b pb-2">
          <dt className="text-muted-foreground">{t("step5.company")}</dt>
          <dd className="font-medium">{wizard.companyName}</dd>
        </div>
        <div className="flex justify-between border-b pb-2">
          <dt className="text-muted-foreground">{t("step5.adminUser")}</dt>
          <dd className="font-medium">{wizard.admin.email}</dd>
        </div>
      </dl>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          {t("step5.errorGeneric", { error })}
        </p>
      )}

      <StepFooter
        onBack={back}
        onContinue={handleFinish}
        continueLabel={t("common:actions.finish")}
        continueLoading={loading}
      />
    </div>
  );
}
