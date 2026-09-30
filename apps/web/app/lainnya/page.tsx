"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// The old Menu page lives on as Profil; keep old links and bookmarks working.
export default function MoreRedirect() {
  const router = useRouter();
  useEffect(() => router.replace("/profil"), [router]);
  return null;
}
