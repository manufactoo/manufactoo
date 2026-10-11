import * as React from "react";
import { useTranslation } from "react-i18next";
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useWizardStore } from "@/features/wizard/wizard-state";
import { StepFooter } from "@/features/wizard/StepFooter";
import { testOdooConnection } from "@/lib/odoo-test-connection";

export function Step2Odoo() {
  const { t } = useTranslation("wizard");
  const external = useWizardStore((s) => s.external);
  const odooTestResult = useWizardStore((s) => s.odooTestResult);
  const patchExternal = useWizardStore((s) => s.patchExternal);
  const setOdooTestResult = useWizardStore((s) => s.setOdooTestResult);
  const next = useWizardStore((s) => s.next);
  const back = useWizardStore((s) => s.back);
  const persist = useWizardStore((s) => s.persist);

  const [testing, setTesting] = React.useState(false);

  async function handleTest() {
    setTesting(true);
    setOdooTestResult(null);
    try {
      // La version de Odoo (18/19) no se pregunta: se detecta sola contra la
      // propia conexion (common.version(), ver OdooConnectorFactory) -- pedirla
      // aqui solo anadia un paso mas y una comprobacion redundante de "adivina
      // bien" que nunca llegaba a usarse para elegir el adapter.
      const result = await testOdooConnection(external, "wizard");
      setOdooTestResult(result);
    } catch {
      setOdooTestResult({ success: false, odooVersion: null, errorMessage: "network_error" });
    } finally {
      setTesting(false);
    }
  }

  async function handleContinue() {
    await persist();
    next();
  }

  const canContinue = odooTestResult?.success === true;

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t("step2.title")}</h1>
      <p className="mt-1 text-muted-foreground">{t("step2.subtitle")}</p>

      <div className="mt-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="odoo-host">{t("step2.externalHost")}</Label>
            <Input id="odoo-host" value={external.host} onChange={(e) => patchExternal({ host: e.target.value })} placeholder="odoo.miempresa.com" />
            <p className="text-xs text-muted-foreground">{t("step2.hostHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="odoo-port">{t("step2.externalPort")}</Label>
            <Input
              id="odoo-port"
              type="number"
              value={external.port}
              onChange={(e) => patchExternal({ port: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="odoo-db">{t("step2.externalDatabase")}</Label>
            <Input id="odoo-db" value={external.database} onChange={(e) => patchExternal({ database: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="odoo-user">{t("step2.externalUsername")}</Label>
            <Input id="odoo-user" value={external.username} onChange={(e) => patchExternal({ username: e.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="odoo-key">{t("step2.externalApiKey")}</Label>
            <Input
              id="odoo-key"
              type="password"
              value={external.apiKeyOrPassword}
              onChange={(e) => patchExternal({ apiKeyOrPassword: e.target.value })}
            />
          </div>
        </div>

        <Button type="button" variant="secondary" onClick={handleTest} disabled={testing}>
          {testing ? t("common:actions.testing") : t("common:actions.test")}
        </Button>

        {odooTestResult && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-md p-3 text-sm",
              odooTestResult.success ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300",
            )}
          >
            {odooTestResult.success ? <IconCircleCheck className="size-4 shrink-0" /> : <IconCircleX className="size-4 shrink-0" />}
            <span>
              {odooTestResult.success
                ? t("step2.testSuccess", { version: odooTestResult.odooVersion })
                : t("step2.testFailure", { error: odooTestResult.errorMessage })}
            </span>
          </div>
        )}
      </div>

      <StepFooter onBack={back} onContinue={handleContinue} continueDisabled={!canContinue} />
    </div>
  );
}
