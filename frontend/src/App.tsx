import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { AppShell } from "@/components/layout/app-shell";
import { RootRedirect } from "@/features/auth/RootRedirect";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { WizardPage } from "@/features/wizard/WizardPage";
import { DashboardHome } from "@/features/dashboard/DashboardHome";
import { MasterDataPage } from "@/features/master-data/MasterDataPage";
import { AppsPage } from "@/features/apps/AppsPage";
import { DevicesPage } from "@/features/devices/DevicesPage";
import { StationsPage } from "@/features/stations/StationsPage";
import { StationBuilderPage } from "@/features/stations/StationBuilderPage";
import { StationRuntimePage } from "@/features/stations/StationRuntimePage";
import { StationRecordsPage } from "@/features/stations/StationRecordsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { ProfilePage } from "@/features/profile/ProfilePage";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/wizard" element={<WizardPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="master-data" element={<MasterDataPage />} />
            <Route path="apps" element={<AppsPage />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="stations" element={<StationsPage />} />
            <Route path="stations/:id/builder" element={<StationBuilderPage />} />
            <Route path="stations/:id/run" element={<StationRuntimePage />} />
            <Route path="stations/:id/records" element={<StationRecordsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
