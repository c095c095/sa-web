import "server-only";
import { type Identity, employee, publicIdentity, requireReady } from "./auth";
import { pool, rows, type Row } from "./db";
import { journey, type Task } from "@/lib/journey";
import { canIssueLink, landingKind } from "@/lib/task-landing";
import { type Workspace } from "@/lib/runtime-contracts";

// primary: the step journey.ts offers for this house. A row that is not primary is
// the SCR-09 re-issue of a link for a customer that is already bound.
export type LandingRow = { unit: Row; task: Task; primary: boolean };

// Houses whose journey (src/lib/journey.ts) offers `screen` to this employee.
// The eligibility rule is journey.ts itself; this function only loads the data
// it reads (units, rounds, defects, requests) for every visible house at once
// and builds one workspace slice per house. Same visibility as workspace():
// non-archived houses for SALES and INSPECTOR.
export async function taskLanding(
  id: Identity,
  screen: string,
): Promise<LandingRow[]> {
  requireReady(id);
  const e = employee(id, ["SALES", "INSPECTOR"]);
  if (landingKind(e.role, screen) !== "houses")
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
  const by = (list: Row[], unit: Row) =>
    list.filter((x) => String(x.unit_id) === String(unit.unit_id));
  const identity = publicIdentity(id);
  const result: LandingRow[] = [];
  for (const unit of units) {
    const unitRounds = by(rounds, unit);
    const roundIds = new Set(unitRounds.map((r) => String(r.round_id)));
    const w: Workspace = {
      identity,
      units: [],
      unit,
      rounds: unitRounds,
      defects: defects.filter((d) => roundIds.has(String(d.round_id))),
      files: [],
      requests: by(requests, unit),
      reports: [],
      queue: [],
      myJobs: [],
      newDefects: [],
      inspectors: [],
      projects: [],
    };
    const task = journey(w).actions.find((a) => a.screen === screen);
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
      });
      continue;
    }
    if (task) result.push({ unit, task, primary: true });
  }
  return result;
}
