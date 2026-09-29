import Link from "next/link";
import { PagePlaceholder } from "@/components/page-placeholder";
import { SignOutButton } from "@/components/sign-out-button";
import { secondaryButton } from "@/components/ui";
import { t } from "@/lib/i18n";

export default function MorePage() {
  return (
    <>
      <PagePlaceholder title={t("nav.more")} />
      <section className="mx-auto flex max-w-md flex-col gap-2 p-4">
        <Link href="/laporan" className={secondaryButton}>
          {t("report.title")}
        </Link>
        <SignOutButton />
      </section>
    </>
  );
}
