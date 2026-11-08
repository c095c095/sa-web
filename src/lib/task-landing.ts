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
