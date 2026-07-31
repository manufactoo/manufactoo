import { Outlet } from "react-router-dom";
import { getCookie } from "@/lib/cookies";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header, HeaderControls } from "@/components/layout/header";
import { getBridge } from "@/features/stations/manufactoo-bridge";

export function AppShell() {
  const defaultOpen = getCookie("sidebar_state") !== "false";

  // Dentro del Manufactoo Player la estacion se abre en modo kiosko: sin
  // barra lateral ni cabecera de administracion, solo la pantalla de la
  // propia estacion a pantalla completa -- el operario no navega a Datos
  // maestros/Ajustes/etc, ni falta que le haga (ver conversacion 2026-07-29).
  if (getBridge()) {
    return <Outlet />;
  }

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
