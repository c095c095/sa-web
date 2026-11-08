import assert from "node:assert/strict";
import { screens, screenRoles } from "../src/lib/runtime-contracts.ts";
import { adminPath, housePath, workflowPath, workflowPaths } from "../src/lib/routes.ts";

const ids = Object.keys(screens);
assert.deepEqual(Object.keys(workflowPaths), ids);
assert.equal(new Set(Object.values(workflowPaths)).size, ids.length);
for (const id of new Set(Object.values(screenRoles).flat())) {
  assert.match(workflowPaths[id], /^\/[a-z-]+$/);
}
assert.equal(workflowPath("SCR-01"), "/houses/new");
assert.equal(workflowPath("SCR-09", "H0001"), "/customer-access/H0001");
assert.equal(workflowPath("SCR-03", "H0001", "D0001", "water & paint"), "/repairs/H0001/D0001?q=water%20%26%20paint");
assert.equal(housePath("H0001"), "/houses/H0001");
assert.equal(adminPath("overview"), "/");
assert.equal(adminPath("projects"), "/admin/projects");
console.log("PASS: named paths cover every workflow");
