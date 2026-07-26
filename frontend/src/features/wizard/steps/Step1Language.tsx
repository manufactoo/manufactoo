import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useWizardStore } from "@/features/wizard/wizard-state";
import { StepFooter } from "@/features/wizard/StepFooter";
import { setAppLanguage, SUPPORTED_LANGUAGES, type SupportedLanguageCode } from "@/i18n";

export function Step1Language() {
  const { t } = useTranslation("wizard");
  const language = useWizardStore((s) => s.language);
  const patch = useWizardStore((s) => s.patch);
  const next = useWizardStore((s) => s.next);
  const persist = useWizardStore((s) => s.persist);

  function selectLanguage(code: SupportedLanguageCode) {
    patch({ language: code });
    setAppLanguage(code);
  }

  async function handleContinue() {
    await persist();
    next();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t("step1.title")}</h1>
      <p className="mt-1 text-muted-foreground">{t("step1.subtitle")}</p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => selectLanguage(lang.code)}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent",
              language === lang.code && "border-primary ring-1 ring-primary",
            )}
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {lang.flag}
            </span>
            <span className="font-medium">{lang.nativeName}</span>
          </button>
        ))}
      </div>

      <StepFooter onContinue={handleContinue} />
    </div>
  );
}
