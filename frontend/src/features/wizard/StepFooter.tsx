import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function StepFooter({
  onBack,
  onContinue,
  continueLabel,
  continueDisabled,
  continueLoading,
}: {
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  continueLoading?: boolean;
}) {
  const { t } = useTranslation("common");

  return (
    <div className="mt-8 flex items-center justify-between">
      {onBack ? (
        <Button type="button" variant="outline" onClick={onBack}>
          {t("actions.back")}
        </Button>
      ) : (
        <span />
      )}
      <Button type="button" onClick={onContinue} disabled={continueDisabled || continueLoading}>
        {continueLoading ? t("actions.testing") : continueLabel ?? t("actions.continue")}
      </Button>
    </div>
  );
}
