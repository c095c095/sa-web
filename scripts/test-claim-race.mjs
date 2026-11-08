// Repeats the UC-03 concurrent claim (technician EMP0005 against head technician EMP0008)
// and checks the database after every round. Expected by design (src/server/auth.ts
// scopedDefect): exactly one winner; a losing technician gets 404 because technicians
// cannot see a job somebody else took; a losing head technician gets 409.
// Harness only. Synthetic test DB only; each round resets the owned test fixture.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { connect, local, evidence, testBase } from "./db-common.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const rounds = Number(process.env.RACE_ROUNDS || 12);
assert(Number.isInteger(rounds) && rounds > 0 && rounds <= 100, "RACE_ROUNDS must be 1..100");
const out = { started_at: new Date().toISOString(), rounds, results: [], tally: {} };

for (let i = 1; i <= rounds; i++) {
  execFileSync("node", [path.join(here, "prepare-runtime-test.mjs")], { stdio: "ignore", env: process.env });
  const fixture = JSON.parse(fs.readFileSync(path.join(local, "runtime-test.json"), "utf8"));
  const base = fixture.base;
  assert.equal(base, testBase);
  const login = async (employee_id) => {
    const r = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ employee_id, password: fixture.password }),
    });
    assert.equal(r.status, 200, "login " + employee_id);
    return r.headers.get("set-cookie").split(";")[0];
  };
  const [tech, head] = [await login("EMP0005"), await login("EMP0008")];
  const db = await connect("sa_web_test_p1");
  try {
    const [[emp]] = await db.query("SELECT craft_category FROM employee WHERE employee_id='EMP0005'");
    const [[target]] = await db.query(
      "SELECT defect_id FROM defect WHERE status='WAITING_ASSIGN' AND category=? ORDER BY defect_id LIMIT 1",
      [emp.craft_category],
    );
    assert(target, "fixture needs a waiting defect for the technician's craft");
    const snapshot = async () =>
      (await db.query("SELECT defect_id, status, technician_id FROM defect ORDER BY defect_id"))[0];
    const before = await snapshot();
    const claim = (cookie) =>
      fetch(base + "/api/actions/UC-03", {
        method: "POST",
        headers: { "content-type": "application/json", origin: base, cookie },
        body: JSON.stringify({ defect_ids: [target.defect_id] }),
      }).then((r) => r.status);
    const [techStatus, headStatus] = await Promise.all([claim(tech), claim(head)]);
    const after = await snapshot();
    const [[row]] = await db.query(
      "SELECT technician_id, status, assigned_date FROM defect WHERE defect_id=?",
      [target.defect_id],
    );

    assert.equal([techStatus, headStatus].filter((s) => s === 200).length, 1, `round ${i}: exactly one claim must succeed (${techStatus}, ${headStatus})`);
    assert.equal(row.status, "ASSIGNED", `round ${i}: final status`);
    assert(row.assigned_date, `round ${i}: assigned_date missing`);
    if (row.technician_id === "EMP0005") {
      assert.equal(techStatus, 200, `round ${i}: technician won in the database`);
      assert.equal(headStatus, 409, `round ${i}: losing head must get 409`);
    } else {
      assert.equal(row.technician_id, "EMP0008", `round ${i}: unexpected winner ${row.technician_id}`);
      assert.equal(headStatus, 200, `round ${i}: head won in the database`);
      assert.equal(techStatus, 404, `round ${i}: losing technician must get 404`);
    }
    const changed = after.filter((a, k) => JSON.stringify(a) !== JSON.stringify(before[k]));
    assert.equal(changed.length, 1, `round ${i}: ${changed.length} defects changed, want 1`);
    assert.equal(String(changed[0].defect_id), String(target.defect_id), `round ${i}: wrong defect changed`);

    const key = `winner=${row.technician_id} tech=${techStatus} head=${headStatus}`;
    out.tally[key] = (out.tally[key] || 0) + 1;
    out.results.push({ round: i, tech: techStatus, head: headStatus, winner: row.technician_id, final_status: row.status, defects_changed: changed.length });
  } finally {
    await db.end();
  }
}

out.status = "PASS";
out.finished_at = new Date().toISOString();
fs.mkdirSync(evidence, { recursive: true });
fs.writeFileSync(path.join(evidence, process.env.CLAIM_RACE_EVIDENCE || "claim-race.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ status: out.status, rounds, tally: out.tally }));
