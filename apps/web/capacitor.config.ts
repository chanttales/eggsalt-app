import type { CapacitorConfig } from "@capacitor/cli";

// The Android app bundles the static export (built with an empty NEXT_PUBLIC_BASE_PATH), so it
// opens instantly and works offline; it never loads the site from a remote URL.
const config: CapacitorConfig = {
  appId: "id.papan.app",
  appName: "EggSalt",
  webDir: "out",
  android: {
    allowMixedContent: false,
  },
};

export default config;
