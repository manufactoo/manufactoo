import * as React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconStack2 } from "@tabler/icons-react";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { useCompanyStore } from "@/features/company/company-store";
import { useCompanyLogoUrl } from "@/lib/use-company-logo-url";

export function AppTitle() {
  const { t } = useTranslation("common");
  const { setOpenMobile } = useSidebar();
  const company = useCompanyStore((s) => s.company);
  const loaded = useCompanyStore((s) => s.loaded);
  const fetchCompany = useCompanyStore((s) => s.fetch);
  const logoUrl = useCompanyLogoUrl(company?.hasLogo ?? false, company?.logoUpdatedAt ?? null);

  React.useEffect(() => {
    if (!loaded) {
      void fetchCompany();
    }
  }, [loaded, fetchCompany]);

  const displayName = company?.name || t("app.name");

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="gap-0 py-0 hover:bg-transparent active:bg-transparent" asChild>
          <Link to="/dashboard" onClick={() => setOpenMobile(false)}>
            <div
              className={`flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg ${
                logoUrl ? "" : "bg-sidebar-primary text-sidebar-primary-foreground"
              }`}
            >
              {logoUrl ? (
                <img src={logoUrl} alt={displayName} className="size-full object-contain" />
              ) : (
                <IconStack2 className="size-4" />
              )}
            </div>
            <div className="ml-2 flex flex-1 items-center text-left text-sm group-data-[collapsible=icon]:hidden">
              <span className="truncate font-bold">{displayName}</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
