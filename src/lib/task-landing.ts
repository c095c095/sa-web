// Phase 2A: menu items that open their own landing page at /tasks/SCR-XX.
// Pure: no IO. Which houses appear on a landing page is NOT decided here; it
// comes from journey.ts (server/tasks.ts). This file only says which menu
// items have a landing page and what kind it is.
//
// SCR-09 (Decision 1, option A): journey.ts offers it for READY_TO_SELL and
// CONTRACTED (primary action) while the screen and the server also let sales
// re-issue a link in later states. Both stay: see canIssueLink and docs/FINAL-VERIFICATION-REPORT.md §1.1.
// Customers are out of scope (Q12): their menu and pages are unchanged.
import { screenRoles } from "./runtime-contracts";

// "register" is a landing with one call to action and no house list (SCR-01).
export type LandingKind = "houses" | "jobs" | "register";
export type JobTab = "queue" | "mine" | "new";

const HOUSE_LANDING: Record<string, string[]> = {
  SALES: ["SCR-09", "SCR-12", "SCR-13"],
  INSPECTOR: ["SCR-02", "SCR-05", "SCR-06", "SCR-07", "SCR-08", "SCR-16"],
};
// Technician screens list defects, not houses. They reuse the HomeHub tabs (Q13);
// the tab is the one home-hub.tsx already links to the same screen.
const JOB_TAB: Record<string, JobTab> = {
  "SCR-03": "queue",
  "SCR-04": "mine",
  "SCR-15": "new",
};
const REGISTER_LANDING: Record<string, string[]> = { SALES: ["SCR-01"] };

export function landingKind(role: string, screen: string): LandingKind | null {
  if (!(screenRoles[role] ?? []).includes(screen)) return null;
  if (HOUSE_LANDING[role]?.includes(screen)) return "houses";
  if (REGISTER_LANDING[role]?.includes(screen)) return "register";
  if (
    (role === "TECHNICIAN" || role === "HEAD_TECHNICIAN") &&
    screen in JOB_TAB
  )
    return "jobs";
  return null;
}

// Decision 4: /app?screen=X without a house goes to the landing page instead of
// the house picker, but only for screens that need a house and have a landing.
// "register" is excluded: its call to action points at /app?screen=SCR-01, so
// redirecting it back would loop.
export function redirectsToLanding(role: string, screen: string): boolean {
  const kind = landingKind(role, screen);
  return kind === "houses" || kind === "jobs";
}

// Visibility on the SCR-09 landing: the houses the SCR-09 screen can act on
// (workbench.tsx: bind form for READY_TO_SELL, re-issue for a bound customer
// that is not handed over). The server accepts the same houses (workflows.ts
// UC-09) and refuses the rest; test-task-landing T-LAND-17 calls UC-09 for every
// fixture house to prove the two agree. Which rows are the primary action is
// not decided here; that comes from journey.ts.
export function canIssueLink(unit: { status?: unknown; customer_id?: unknown }) {
  return (
    unit.status === "READY_TO_SELL" ||
    (Boolean(unit.customer_id) && unit.status !== "HANDED_OVER")
  );
}

export const jobTab = (screen: string): JobTab | undefined => JOB_TAB[screen];
export const landingPath = (screen: string) => "/tasks/" + screen;
