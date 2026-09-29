import { SignOutButton } from "@/components/sign-out-button";
import { t } from "@/lib/i18n";

// Signed in but not in any workspace yet. The onboarding task replaces this with template setup.
export default function StartPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-title-lg font-bold">{t("setup.title")}</h1>
        <p className="text-muted-foreground">{t("setup.noWorkspace")}</p>
      </header>
      <SignOutButton />
    </main>
  );
}
