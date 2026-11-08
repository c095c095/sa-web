import "server-only";
import { type Identity, employee, publicIdentity, requireReady } from "./auth";
import { pool, rows, type Row } from "./db";
import { journey, type Task } from "@/lib/journey";
import { canIssueLink, taskContext } from "@/lib/task-landing";
import { screenRoles, type Workspace } from "@/lib/runtime-contracts";

// Primary rows are actionable according to journey.ts. Secondary rows support
// reissuing existing access or reviewing report readiness and history.
export type LandingRow = {
  unit: Row;
  task: Task;
  primary: boolean;
  context: string;
};

// Houses whose journey (src/lib/journey.ts) offers `screen` to this employee.
// The eligibility rule is journey.ts itself; this function only loads the data
// it reads (units, rounds, defects, requests) for every visible house at once
// and builds one workspace slice per house. Same visibility as workspace():
// non-archived houses for SALES and INSPECTOR.
export async function taskLanding(
  id: Identity,
  screen?: string,
): Promise<LandingRow[]> {
  requireReady(id);
  const e = employee(id, ["SALES", "INSPECTOR"]);
  if (screen && (screen === "SCR-01" || !screenRoles[e.role].includes(screen)))
    throw new Error("screen has no house landing for this role");
  const units = await rows(
    pool,
    "SELECT u.*,c.full_name customer_name FROM property_unit u LEFT JOIN customer c ON c.customer_id=u.customer_id WHERE u.archived_at IS NULL ORDER BY u.created_at DESC,u.unit_id DESC",
  );
  if (!units.length) return [];
  const [rounds, defects, requests] = await Promise.all([
    rows(
      pool,
      "SELECT r.* FROM inspection_round r JOIN property_unit u ON u.unit_id=r.unit_id WHERE u.archived_at IS NULL ORDER BY r.started_at DESC,r.round_id DESC",
    ),
    rows(
      pool,
      "SELECT d.*,r.unit_id FROM defect d JOIN inspection_round r ON r.round_id=d.round_id JOIN property_unit u ON u.unit_id=r.unit_id WHERE u.archived_at IS NULL ORDER BY d.created_at,d.defect_id",
    ),
    rows(
      pool,
      "SELECT q.* FROM inspection_request q JOIN property_unit u ON u.unit_id=q.unit_id WHERE u.archived_at IS NULL ORDER BY q.created_at DESC",
    ),
  ]);
  const groupByUnit = (list: Row[]) => {
    const groups = new Map<string, Row[]>();
    for (const row of list) {
      const key = String(row.unit_id);
      const group = groups.get(key);
      if (group) group.push(row);
      else groups.set(key, [row]);
    }
    return groups;
  };
  const roundsByUnit = groupByUnit(rounds);
  const defectsByUnit = groupByUnit(defects);
  const requestsByUnit = groupByUnit(requests);
  const identity = publicIdentity(id);
  const result: LandingRow[] = [];
  for (const unit of units) {
    const key = String(unit.unit_id);
    const w: Workspace = {
      identity,
      units: [],
      unit,
      rounds: roundsByUnit.get(key) ?? [],
      defects: defectsByUnit.get(key) ?? [],
      files: [],
      requests: requestsByUnit.get(key) ?? [],
      reports: [],
      queue: [],
      myJobs: [],
      newDefects: [],
      inspectors: [],
      projects: [],
    };
    const actions = journey(w).actions;
    if (!screen) {
      for (const task of actions)
        result.push({
          unit,
          task,
          primary: true,
          context: taskContext(w, task.screen),
        });
      continue;
    }
    const task = actions.find((a) => a.screen === screen);
    if (screen === "SCR-09") {
      if (!canIssueLink(unit)) continue;
      result.push({
        unit,
        task: task ?? {
          screen,
          title: "สร้างลิงก์ใหม่ให้ลูกค้าเดิม",
          hint: `ลูกค้า ${unit.customer_name ?? ""} · ลิงก์ใหม่มีอายุ 30 วัน`,
        },
        primary: Boolean(task),
        context: taskContext(w, screen),
      });
      continue;
    }
    if (task) {
      result.push({
        unit,
        task,
        primary: true,
        context: taskContext(w, screen),
      });
    } else if (
      screen === "SCR-16" &&
      w.rounds.some((round) => round.round_type === "CUSTOMER_HANDOVER")
    ) {
      result.push({
        unit,
        task: { screen, title: "ดูความคืบหน้าและเอกสาร", hint: "" },
        primary: false,
        context: taskContext(w, screen),
      });
    }
  }
  return result;
}
