import * as React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiClient } from "@/lib/api-client";
import { useAvatarUrl } from "@/lib/use-avatar-url";
import { useAuthStore, type AuthUser } from "@/features/auth/auth-store";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];

function AvatarEditor() {
  const { t } = useTranslation("dashboard");
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const avatarUrl = useAvatarUrl(user?.hasAvatar ?? false, user?.avatarUpdatedAt ?? null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [busy, setBusy] = React.useState<"upload" | "remove" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setError(t("profile.photo.errorType"));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError(t("profile.photo.errorSize"));
      return;
    }

    setBusy("upload");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await apiClient.post<AuthUser>("/api/users/me/avatar", formData, {
        headers: { "Content-Type": undefined },
      });
      updateUser(data);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message ?? t("profile.photo.errorType"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    setError(null);
    setBusy("remove");
    try {
      const { data } = await apiClient.delete<AuthUser>("/api/users/me/avatar");
      updateUser(data);
    } catch {
      setError(t("profile.photo.errorType"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <Label>{t("profile.photo.title")}</Label>
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage src={avatarUrl ?? undefined} alt={user?.name} />
          <AvatarFallback className="text-lg">{(user?.name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => fileInputRef.current?.click()}>
              {busy === "upload" ? t("profile.photo.uploading") : t("profile.photo.upload")}
            </Button>
            {user?.hasAvatar && (
              <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={handleRemove}>
                {busy === "remove" ? t("profile.photo.removing") : t("profile.photo.remove")}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("profile.photo.hint")}</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function ProfilePage() {
  const { t } = useTranslation("dashboard");
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [name, setName] = React.useState(user?.name ?? "");
  const [email, setEmail] = React.useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const { data } = await apiClient.put("/api/users/me", {
        name,
        email,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      updateUser(data);
      setCurrentPassword("");
      setNewPassword("");
      setSaved(true);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Error";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("profile.title")}</h1>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{user?.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <AvatarEditor />

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">{t("profile.name")}</Label>
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">{t("profile.email")}</Label>
              <Input id="profile-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-current-password">{t("profile.currentPassword")}</Label>
              <Input
                id="profile-current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-new-password">{t("profile.newPassword")}</Label>
              <Input id="profile-new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                {t("common:actions.save")}
              </Button>
              {saved && <span className="text-sm text-emerald-600">{t("profile.saved")}</span>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
