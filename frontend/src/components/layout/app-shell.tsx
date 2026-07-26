import { Outlet } from "react-router-dom";
import { getCookie } from "@/lib/cookies";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header, HeaderControls } from "@/components/layout/header";

export function AppShell() {
  const defaultOpen = getCookie("sidebar_state") !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset>
        <Header>
          <HeaderControls />
        </Header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
