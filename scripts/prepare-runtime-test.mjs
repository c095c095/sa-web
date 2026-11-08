import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { local, connect, resetOwnedTest } from "./db-common.mjs";
const c = await connect("sa_web_test_p1");
try {
  await resetOwnedTest(c);
  const password = crypto.randomBytes(18).toString("base64url");
  const hash = await bcrypt.hash(password, 12);
  await c.execute("UPDATE employee SET password_hash=?", [hash]);
  const [links] = await c.query("SELECT link_id,token FROM access_link");
  for (const l of links)
    await c.execute("UPDATE access_link SET token=? WHERE link_id=?", [
      crypto.createHash("sha256").update(l.token).digest("hex"),
      l.link_id,
    ]);
  fs.writeFileSync(
    path.join(local, "runtime-test.json"),
    JSON.stringify(
      {
        base: "http://127.0.0.1:3001",
        password,
        links: links.map((l) => ({ link_id: l.link_id, token: l.token })),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Runtime test fixture reset in the owned test database; credentials remain local.",
  );
} finally {
  await c.end();
}
const storage = path.resolve(local, "test-storage"),
  archive = path.resolve(local, "backups", "test-storage-" + Date.now());
if (
  storage !== path.resolve(process.cwd(), ".local/test-storage") ||
  !archive.startsWith(path.resolve(local, "backups") + path.sep)
)
  throw new Error("Test storage target is outside owned workspace");
if (fs.existsSync(storage)) {
  fs.mkdirSync(path.dirname(archive), { recursive: true });
  fs.renameSync(storage, archive);
}
