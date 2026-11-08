// Unit tests for the Q7 deep-link allowlist (src/lib/deep-link.ts).
// Valid and invalid next values. No network, no database.
import assert from "node:assert/strict";
import { parseNext, buildAppPath, requiresHouse } from "../src/lib/deep-link.ts";

const ALLOWED = ["SCR-02", "SCR-05", "SCR-09", "SCR-12", "SCR-13"];
const results = [];
function expectValid(name, value, expected) {
  const got = parseNext(value, ALLOWED);
  assert.deepEqual(got, expected, name);
  results.push({ name, status: "PASS" });
}
function expectInvalid(name, value) {
  assert.equal(parseNext(value, ALLOWED), null, name);
  results.push({ name, status: "PASS" });
}

// Valid
expectValid("valid: screen only", "/app?screen=SCR-09", { screen: "SCR-09" });
expectValid("valid: screen + defect", "/app?screen=SCR-05&defect=12", { screen: "SCR-05", defect: "12" });
expectValid("valid: defect with dash/underscore", "/app?screen=SCR-05&defect=D-12_a", { screen: "SCR-05", defect: "D-12_a" });

// Invalid: external and protocol tricks
expectInvalid("invalid: absolute http URL", "https://evil.example/app?screen=SCR-09");
expectInvalid("invalid: protocol-relative", "//evil.example/app?screen=SCR-09");
expectInvalid("invalid: backslash host trick", "/\\evil.example/app?screen=SCR-09");
expectInvalid("invalid: javascript scheme", "javascript:alert(1)");
expectInvalid("invalid: leading whitespace", " /app?screen=SCR-09");
expectInvalid("invalid: encoded slash prefix", "%2F%2Fevil.example/app?screen=SCR-09");
expectInvalid("invalid: control character", "/app?screen=SCR-09\n");
expectInvalid("invalid: NUL byte", "/app?screen=SCR-09\u0000");

// Invalid: path traversal and wrong path
expectInvalid("invalid: traversal to admin", "/app/../admin?screen=SCR-09");
expectInvalid("invalid: encoded traversal", "/app/%2e%2e/admin?screen=SCR-09");
expectInvalid("invalid: other internal path", "/admin?screen=SCR-09");
expectInvalid("invalid: /app without query", "/app");
expectInvalid("invalid: /app/sub path", "/app/extra?screen=SCR-09");

// Invalid: parameters
expectInvalid("invalid: unit carried in next", "/app?screen=SCR-09&unit=H0001");
expectInvalid("invalid: unknown key", "/app?screen=SCR-09&return=/admin");
expectInvalid("invalid: duplicate screen", "/app?screen=SCR-09&screen=SCR-05");
expectInvalid("invalid: duplicate defect", "/app?screen=SCR-05&defect=1&defect=2");
expectInvalid("invalid: screen not in role", "/app?screen=SCR-99");
expectInvalid("invalid: screen of another role", "/app?screen=SCR-16");
expectInvalid("invalid: missing screen", "/app?defect=12");
expectInvalid("invalid: defect with traversal", "/app?screen=SCR-05&defect=../x");
expectInvalid("invalid: defect with markup", "/app?screen=SCR-05&defect=%3Cscript%3E");
expectInvalid("invalid: defect too long", "/app?screen=SCR-05&defect=" + "a".repeat(65));

// Invalid: type and size
expectInvalid("invalid: undefined", undefined);
expectInvalid("invalid: null", null);
expectInvalid("invalid: number", 42);
expectInvalid("invalid: array", ["/app?screen=SCR-09"]);
expectInvalid("invalid: empty string", "");
expectInvalid("invalid: over 200 characters", "/app?screen=SCR-09&defect=" + "a".repeat(200));

// Builder output round-trips through the parser
const built = buildAppPath({ screen: "SCR-09", defect: "12" }, "H0001");
assert.equal(built, "/app?screen=SCR-09&unit=H0001&defect=12");
assert.deepEqual(parseNext(buildAppPath({ screen: "SCR-09", defect: "12" }), ALLOWED), { screen: "SCR-09", defect: "12" });
results.push({ name: "builder round-trips through parser", status: "PASS" });
assert.equal(buildAppPath({ screen: "SCR-09", defect: "../x" }), "/app?screen=SCR-09", "bad defect must be dropped by builder");
results.push({ name: "builder drops malformed defect", status: "PASS" });

// House requirement (SCR-01 is the only house-free screen)
assert.equal(requiresHouse("SCR-01"), false);
assert.equal(requiresHouse("SCR-09"), true);
results.push({ name: "requiresHouse: SCR-01 free, others need a house", status: "PASS" });

console.log(JSON.stringify({ status: "PASS", cases: results.length }));
