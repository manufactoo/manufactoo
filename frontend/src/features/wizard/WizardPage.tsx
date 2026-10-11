import * as React from "react";
import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { useWizardStore } from "@/features/wizard/wizard-state";
import { Step1Language } from "@/features/wizard/steps/Step1Language";
import { Step2Odoo } from "@/features/wizard/steps/Step2Odoo";
import { Step3Company } from "@/features/wizard/steps/Step3Company";
import { Step4Admin } from "@/features/wizard/steps/Step4Admin";
import { Step5Summary } from "@/features/wizard/steps/Step5Summary";

const TOTAL_STEPS = 5;

export function WizardPage() {
  const { t } = useTranslation("wizard");
  const currentStep = useWizardStore((s) => s.currentStep);
  const hydrated = useWizardStore((s) => s.hydrated);
  const hydrate = useWizardStore((s) => s.hydrate);

  React.useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return <div className="flex h-svh items-center justify-center text-muted-foreground">...</div>;
  }

  return (
    <div className="flex min-h-svh flex-col items-center bg-muted/30 px-4 py-10">
      <div className="mb-8 flex items-center gap-2">
        {/* Dos PNG, una por tema -- Tailwind alterna con la clase .dark que pone
            ThemeProvider en <html> (ver theme-provider.tsx), no con
            prefers-color-scheme directo, para respetar el tema elegido por el
            usuario y no solo el del SO. */}
        <img src="/manufactoo-logo.png" alt="Manufactoo" className="size-8 dark:hidden" />
        <img src="/manufactoo-logo-dark.png" alt="Manufactoo" className="hidden size-8 dark:block" />
        <span className="text-xl font-semibold">Manufactoo</span>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        <div className="space-y-2">
          <Progress value={(currentStep / TOTAL_STEPS) * 100} />
          <p className="text-center text-sm text-muted-foreground">
            {t("progress.step", { current: currentStep, total: TOTAL_STEPS })}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-8 shadow-sm">
          {currentStep === 1 && <Step1Language />}
          {currentStep === 2 && <Step2Odoo />}
          {currentStep === 3 && <Step3Company />}
          {currentStep === 4 && <Step4Admin />}
          {currentStep === 5 && <Step5Summary />}
        </div>
      </div>
    </div>
  );
}
