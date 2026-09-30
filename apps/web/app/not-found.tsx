import { SearchX } from "lucide-react";
import Link from "next/link";
import { primaryButton } from "@/components/ui";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-4 text-center">
      <SearchX aria-hidden size={40} className="text-muted-foreground" />
      <h1 className="text-title font-bold">{t("notFound.title")}</h1>
      <p className="text-muted-foreground">{t("notFound.body")}</p>
      <Link href="/" className={`${primaryButton} flex items-center justify-center`}>
        {t("error.home")}
      </Link>
    </main>
  );
}
