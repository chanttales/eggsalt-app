import { PagePlaceholder } from "@/components/page-placeholder";
import { SignOutButton } from "@/components/sign-out-button";
import { t } from "@/lib/i18n";

export default function MorePage() {
  return (
    <>
      <PagePlaceholder title={t("nav.more")} />
      <section className="mx-auto max-w-md p-4">
        <SignOutButton />
      </section>
    </>
  );
}
