export const workflowPaths: Readonly<Record<string, string>> = {
  "SCR-01": "/houses",
  "SCR-02": "/qc-inspections",
  "SCR-03": "/repairs",
  "SCR-04": "/assigned-repairs",
  "SCR-05": "/repair-reviews",
  "SCR-06": "/qc-rechecks",
  "SCR-07": "/qc-closures",
  "SCR-08": "/sales-readiness",
  "SCR-09": "/customer-access",
  "SCR-10": "/inspection-preferences",
  "SCR-11": "/inspection-requests",
  "SCR-12": "/assisted-inspection-requests",
  "SCR-13": "/inspection-appointments",
  "SCR-14": "/handover-defects",
  "SCR-15": "/repair-triage",
  "SCR-16": "/repair-reports",
  "SCR-17": "/repair-status",
  "SCR-18": "/handover-signatures",
};

export function withSearch(path: string, q?: string) {
  return q ? path + "?q=" + encodeURIComponent(q) : path;
}

export function workflowPath(
  screen: string,
  unit?: string,
  defect?: string,
  q?: string,
) {
  const path = workflowPaths[screen];
  if (!path) throw new Error("Unknown workflow: " + screen);
  const detail =
    screen === "SCR-01"
      ? path + "/new"
      : unit
        ? path + "/" + encodeURIComponent(unit)
        : path;
  return withSearch(
    unit && defect ? detail + "/" + encodeURIComponent(defect) : detail,
    q,
  );
}

export function housePath(unit: string, q?: string) {
  return withSearch("/houses/" + encodeURIComponent(unit), q);
}

export function adminPath(section: string) {
  return section === "overview" ? "/" : "/admin/" + encodeURIComponent(section);
}
