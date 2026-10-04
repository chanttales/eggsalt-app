"use client";

import { GUIDE_PAGES, GuideList } from "@/components/guide";
import { Page, Section } from "@/components/ui";
import { t, tOr } from "@/lib/i18n";

export default function GuidePage() {
  return (
    <Page back="/profil" title={t("guide.all")}>
      {GUIDE_PAGES.map((page) => (
        <Section key={page} title={tOr(`guide.${page}.title`, page)}>
          <GuideList page={page} />
        </Section>
      ))}
    </Page>
  );
}
