import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWizardStore } from "@/features/wizard/wizard-state";
import { StepFooter } from "@/features/wizard/StepFooter";

export function Step4Admin() {
  const { t } = useTranslation("wizard");
  const admin = useWizardStore((s) => s.admin);
  const patchAdmin = useWizardStore((s) => s.patchAdmin);
  const next = useWizardStore((s) => s.next);
  const back = useWizardStore((s) => s.back);
  const persist = useWizardStore((s) => s.persist);

  const passwordTooShort = admin.password.length > 0 && admin.password.length < 8;
  const passwordMismatch = admin.passwordConfirm.length > 0 && admin.password !== admin.passwordConfirm;

  const canContinue =
    admin.fullName.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(admin.email) &&
    admin.password.length >= 8 &&
    admin.password === admin.passwordConfirm;

  async function handleContinue() {
    await persist();
    next();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t("step4.title")}</h1>
      <p className="mt-1 text-muted-foreground">{t("step4.subtitle")}</p>

      <div className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="admin-name">{t("step4.fullName")}</Label>
          <Input id="admin-name" value={admin.fullName} onChange={(e) => patchAdmin({ fullName: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-email">{t("step4.email")}</Label>
          <Input id="admin-email" type="email" value={admin.email} onChange={(e) => patchAdmin({ email: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="admin-password">{t("step4.password")}</Label>
            <Input
              id="admin-password"
              type="password"
              value={admin.password}
              onChange={(e) => patchAdmin({ password: e.target.value })}
            />
            {passwordTooShort && <p className="text-xs text-destructive">{t("step4.passwordTooShort")}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password-confirm">{t("step4.passwordConfirm")}</Label>
            <Input
              id="admin-password-confirm"
              type="password"
              value={admin.passwordConfirm}
              onChange={(e) => patchAdmin({ passwordConfirm: e.target.value })}
            />
            {passwordMismatch && <p className="text-xs text-destructive">{t("step4.passwordMismatch")}</p>}
          </div>
        </div>


      </div>

      <StepFooter onBack={back} onContinue={handleContinue} continueDisabled={!canContinue} />
    </div>
  );
}
