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

export type ListFilters = {
  q?: string;
  project?: string;
  status?: string;
  category?: string;
};

export function withSearch(path: string, filters?: string | ListFilters) {
  const params = new URLSearchParams();
  const values = typeof filters === "string" ? { q: filters } : filters;
  for (const [key, value] of Object.entries(values ?? {})) {
    if (value) params.set(key, value);
  }
  return params.size
    ? path + "?" + params.toString().replaceAll("+", "%20")
    : path;
}

export function workflowPath(
  screen: string,
  unit?: string,
  defect?: string,
  q?: string | ListFilters,
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
