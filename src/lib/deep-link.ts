// Deep-link helpers for house-scoped screens (Phase 1A / Q7 option A).
// Pure: no imports, no IO. Used by app/app/page.tsx, app/home/page.tsx and
// components/home-hub.tsx. Authorization is NOT decided here; /app still checks
// the role's allowed screens and scopedUnit() still checks the house.

export type DeepLink = { screen: string; defect?: string };

// Screens that do not operate on a house. Everything else needs a unit.
export const HOUSE_FREE_SCREENS: readonly string[] = ["SCR-01"];

const DEFECT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const NEXT_MAX_LENGTH = 200;
const INTERNAL_ORIGIN = "http://local.invalid";

export function requiresHouse(screen: string): boolean {
  return !HOUSE_FREE_SCREENS.includes(screen);
}

// Builds an internal /app path from validated parts only. Never echoes raw input.
export function buildAppPath(link: DeepLink, unit?: string): string {
  const parts = ["screen=" + encodeURIComponent(link.screen)];
  if (unit) parts.push("unit=" + encodeURIComponent(unit));
  if (link.defect && DEFECT_ID.test(link.defect))
    parts.push("defect=" + encodeURIComponent(link.defect));
  return "/app?" + parts.join("&");
}

// Accepts only an internal path under /app with the keys screen and defect.
// Anything else (external URL, protocol-relative, traversal, unknown key,
// duplicate key, unknown or disallowed screen, malformed defect) yields null.
export function parseNext(
  value: unknown,
  allowedScreens: readonly string[],
): DeepLink | null {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > NEXT_MAX_LENGTH) return null;
  // control characters, backslash (browsers may treat it as a slash)
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;
  if (!value.startsWith("/app?")) return null;
  if (value.includes("//")) return null;
  let url: URL;
  try {
    url = new URL(value, INTERNAL_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== INTERNAL_ORIGIN) return null;
  if (url.pathname !== "/app") return null;
  for (const key of url.searchParams.keys())
    if (key !== "screen" && key !== "defect") return null;
  if (url.searchParams.getAll("screen").length !== 1) return null;
  if (url.searchParams.getAll("defect").length > 1) return null;
  const screen = url.searchParams.get("screen");
  if (!screen || !allowedScreens.includes(screen)) return null;
  const defect = url.searchParams.get("defect");
  if (defect !== null && !DEFECT_ID.test(defect)) return null;
  return defect ? { screen, defect } : { screen };
}
