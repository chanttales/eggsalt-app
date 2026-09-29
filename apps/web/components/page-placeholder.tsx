import { t } from "@/lib/i18n";

// Temporary content for tab roots until their screens are built.
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-2 p-4">
      <h1 className="text-title-lg font-bold">{title}</h1>
      <p className="text-muted-foreground">{t("page.placeholder")}</p>
    </main>
  );
}
