import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWizardStore } from "@/features/wizard/wizard-state";
import { StepFooter } from "@/features/wizard/StepFooter";
import { SECTORS } from "@/lib/sectors";

export function Step3Company() {
  const { t } = useTranslation("wizard");
  const companyName = useWizardStore((s) => s.companyName);
  const companySector = useWizardStore((s) => s.companySector);
  const patch = useWizardStore((s) => s.patch);
  const next = useWizardStore((s) => s.next);
  const back = useWizardStore((s) => s.back);
  const persist = useWizardStore((s) => s.persist);

  async function handleContinue() {
    await persist();
    next();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t("step3.title")}</h1>
      <p className="mt-1 text-muted-foreground">{t("step3.subtitle")}</p>

      <div className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="company-name">{t("step3.name")}</Label>
          <Input id="company-name" value={companyName} onChange={(e) => patch({ companyName: e.target.value })} />
        </div>
        <div className="max-w-xs space-y-2">
          <Label>{t("step3.sector")}</Label>
          <Select value={companySector} onValueChange={(v) => patch({ companySector: v })}>
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {SECTORS.map((sector) => (
                <SelectItem key={sector} value={sector}>
                  {t(`common:sectors.${sector}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>


      </div>

      <StepFooter onBack={back} onContinue={handleContinue} continueDisabled={!companyName.trim()} />
    </div>
  );
}
