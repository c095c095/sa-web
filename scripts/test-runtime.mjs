import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import sharp from "sharp";
import { local, evidence, connect, testBase } from "./db-common.mjs";
const fixture = JSON.parse(
    fs.readFileSync(path.join(local, "runtime-test.json"), "utf8"),
  ),
  base = fixture.base;
assert.equal(base, testBase);
const db = await connect("sa_web_test_p1");
const result = {
  started_at: new Date().toISOString(),
  scope:
    "Real HTTP endpoints against isolated MariaDB test database; all data synthetic",
  cases: [],
};
const image = await sharp({
  create: { width: 240, height: 120, channels: 3, background: "#fafafa" },
})
  .composite([
    {
      input: Buffer.from(
        '<svg width="240" height="120"><path d="M20 90 Q60 10 100 80 T210 40" fill="none" stroke="#222" stroke-width="3"/></svg>',
      ),
    },
  ])
  .png()
  .toBuffer();
const picture = () =>
  new File([image], "synthetic-test.png", { type: "image/png" });
async function http(
  route,
  {
    cookie = "",
    data,
    files,
    method = data ? "POST" : "GET",
    origin = base,
  } = {},
) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (method === "POST") headers.Origin = origin;
  let body;
  if (data) {
    if (files) {
      body = new FormData();
      body.set("data", JSON.stringify(data));
      for (const f of files) body.append("photos", f);
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(data);
    }
  }
  const response = await fetch(base + route, { method, headers, body });
  const json = response.headers.get("content-type")?.includes("json")
    ? await response.json()
    : null;
  return {
    status: response.status,
    data: json?.data,
    error: json?.error,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
    headers: response.headers,
    body: json ? null : Buffer.from(await response.arrayBuffer()),
  };
}
async function login(employee_id) {
  const r = await http("/api/auth/login", {
    data: { employee_id, password: fixture.password },
  });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert(r.headers.get("set-cookie").includes("HttpOnly"));
  assert(!JSON.stringify(r.data).includes("sessionId"));
  return r.cookie;
}
async function action(cookie, uc, data, files, status = 200) {
  const r = await http("/api/actions/" + uc, { cookie, data, files });
  assert.equal(r.status, status, uc + " " + JSON.stringify(r.error));
  return r.data;
}
async function row(sql, values = []) {
  return (await db.query(sql, values))[0][0];
}
async function check(id, fn) {
  try {
    await fn();
    result.cases.push({ id, status: "PASS" });
    console.log("PASS", id);
  } catch (e) {
    result.cases.push({ id, status: "FAIL", actual: e.message });
    throw e;
  }
}
let sales,
  inspector,
  tech,
  head,
  customer,
  cookieOther,
  unit,
  round,
  defect,
  request,
  handRound,
  handDefect,
  link;
try {
  await check("AUTH-01 unauthenticated mutation denied", async () => {
    await action(
      "",
      "UC-01",
      { project_name: "x", house_no: "x" },
      undefined,
      401,
    );
  });
  await check(
    "AUTH-02 active employee login and secret-free session",
    async () => {
      sales = await login("EMP0001");
      inspector = await login("EMP0003");
      tech = await login("EMP0005");
      head = await login("EMP0008");
    },
  );
  await check("AUTH-03 inactive and wrong passwords denied", async () => {
    assert.equal(
      (
        await http("/api/auth/login", {
          data: { employee_id: "EMP0011", password: fixture.password },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await http("/api/auth/login", {
          data: { employee_id: "EMP0002", password: "incorrect" },
        })
      ).status,
      401,
    );
  });
  await check("AUTH-04 origin enforcement and role spoof denied", async () => {
    assert.equal(
      (
        await http("/api/actions/UC-01", {
          cookie: sales,
          data: { project_name: "x", house_no: "x" },
          origin: "https://evil.example",
        })
      ).status,
      403,
    );
    await action(
      tech,
      "UC-01",
      { project_name: "x", house_no: "x", role: "SALES" },
      undefined,
      403,
    );
  });
  const project =
    "ทดสอบระบบจริง (ข้อมูลสมมติ) " + crypto.randomBytes(3).toString("hex");
  await db.query("INSERT INTO project(project_name) VALUES(?)",[project]);
  await check("UC01 register and persist Thai house", async () => {
    unit = (
      await action(sales, "UC-01", {
        project_name: project,
        house_no: "TEST-01",
        unit_type: "ข้อมูลทดสอบ",
      })
    ).unit_id;
    assert.equal(
      (await row("SELECT status FROM property_unit WHERE unit_id=?", [unit]))
        .status,
      "IN_QC",
    );
  });
  await check("UC01 duplicate rejected", async () => {
    await action(
      sales,
      "UC-01",
      { project_name: project, house_no: "TEST-01" },
      undefined,
      409,
    );
  });
  await check("UC02 add before photo", async () => {
    defect = (
      await action(
        inspector,
        "UC-02",
        {
          mode: "add",
          unit_id: unit,
          category: "ELECTRICAL",
          location_pin: "ห้องรับแขก",
          description: "ข้อมูลสมมติ <script>alert(1)</script>",
        },
        [picture()],
      )
    ).defect_id;
    round = (
      await row("SELECT round_id FROM defect WHERE defect_id=?", [defect])
    ).round_id;
  });
  await check("FILES genuine type and size validation", async () => {
    await action(
      inspector,
      "UC-02",
      { mode: "add", unit_id: unit, category: "ELECTRICAL", location_pin: "x" },
      [new File(["not an image"], "fake.png", { type: "image/png" })],
      422,
    );
    await action(
      inspector,
      "UC-02",
      { mode: "add", unit_id: unit, category: "ELECTRICAL", location_pin: "x" },
      [
        new File([Buffer.alloc(5 * 1024 * 1024 + 1)], "big.png", {
          type: "image/png",
        }),
      ],
      422,
    );
  });
  await check("UC02 edit and delete with physical photo cleanup", async () => {
    const d = (
      await action(
        inspector,
        "UC-02",
        {
          mode: "add",
          unit_id: unit,
          category: "WALL",
          location_pin: "ลบทดสอบ",
        },
        [picture()],
      )
    ).defect_id;
    await action(inspector, "UC-02", {
      mode: "edit",
      defect_id: d,
      category: "WALL",
      location_pin: "แก้แล้ว",
    });
    const f = await row("SELECT * FROM file WHERE defect_id=?", [d]);
    await action(inspector, "UC-02", {
      mode: "remove-photo",
      defect_id: d,
      file_id: f.file_id,
    });
    assert.equal(
      (await http(new URL(f.file_url).pathname, { cookie: inspector })).status,
      404,
    );
    await action(inspector, "UC-02", { mode: "delete", defect_id: d });
    assert(!(await row("SELECT defect_id FROM defect WHERE defect_id=?", [d])));
  });
  await check(
    "UC02 finish locks persisted edits additions deletions",
    async () => {
      await action(inspector, "UC-02", { mode: "finish", unit_id: unit });
      assert(
        (
          await row(
            "SELECT inspection_finished_at FROM inspection_round WHERE round_id=?",
            [round],
          )
        ).inspection_finished_at,
      );
      for (const data of [
        { mode: "add", unit_id: unit, category: "WALL", location_pin: "x" },
        {
          mode: "edit",
          defect_id: defect,
          category: "WALL",
          location_pin: "x",
        },
        { mode: "delete", defect_id: defect },
      ])
        await action(inspector, "UC-02", data, undefined, 409);
    },
  );
  await check("UC03 craft guard and atomic batch rollback", async () => {
    const plumber = await login("EMP0006");
    await action(plumber, "UC-03", { defect_ids: [defect] }, undefined, 404);
    await action(
      tech,
      "UC-03",
      { defect_ids: [defect, "ZZZZZZ"] },
      undefined,
      404,
    );
    assert.equal(
      (await row("SELECT status FROM defect WHERE defect_id=?", [defect]))
        .status,
      "WAITING_ASSIGN",
    );
  });
  await check("UC03 concurrent claim only one succeeds", async () => {
    const results = await Promise.all([
      http("/api/actions/UC-03", {
        cookie: tech,
        data: { defect_ids: [defect] },
      }),
      http("/api/actions/UC-03", {
        cookie: head,
        data: { defect_ids: [defect] },
      }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const winner = (
      await row("SELECT technician_id FROM defect WHERE defect_id=?", [defect])
    ).technician_id;
    tech = winner === "EMP0005" ? tech : head;
  });
  await check("UC04 requires fresh photo and completes repair", async () => {
    await action(tech, "UC-04", { defect_id: defect }, [], 422);
    await action(tech, "UC-04", { defect_id: defect }, [picture()]);
    assert.equal(
      (await row("SELECT status FROM defect WHERE defect_id=?", [defect]))
        .status,
      "FIXED",
    );
  });
  await check("UC05 rejection rework and repeat repair", async () => {
    await action(inspector, "UC-05", { defect_id: defect, approve: false });
    await action(tech, "UC-04", { defect_id: defect }, [picture()]);
    await action(inspector, "UC-05", { defect_id: defect, approve: true });
    assert.equal(
      (
        await row("SELECT status,rework_count FROM defect WHERE defect_id=?", [
          defect,
        ])
      ).rework_count,
      1,
    );
  });
  await check("UC06 recheck found new defect reopens same round", async () => {
    await action(inspector, "UC-06", {
      mode: "schedule",
      round_id: round,
      recheck_date: "2026-11-12",
    });
    const d = (
      await action(
        inspector,
        "UC-06",
        {
          mode: "result",
          round_id: round,
          recheck_result: "DEFECT_FOUND",
          category: "ELECTRICAL",
          location_pin: "จุดใหม่จากตรวจซ้ำ",
        },
        [picture()],
      )
    ).defect_id;
    assert.equal(
      (
        await row("SELECT status FROM inspection_round WHERE round_id=?", [
          round,
        ])
      ).status,
      "OPEN",
    );
    await action(head, "UC-03", { defect_ids: [d] });
    await action(head, "UC-04", { defect_id: d }, [picture()]);
    await action(inspector, "UC-05", { defect_id: d, approve: true });
  });
  await check(
    "UC06 no defect then UC07 XOR and same inspector blocked",
    async () => {
      await action(inspector, "UC-06", {
        mode: "schedule",
        round_id: round,
        recheck_date: "2026-11-13",
      });
      await action(inspector, "UC-06", {
        mode: "result",
        round_id: round,
        recheck_result: "NO_DEFECT",
      });
      await action(
        inspector,
        "UC-07",
        {
          round_id: round,
          is_single_certify: false,
          co_inspector_id: "EMP0003",
        },
        undefined,
        422,
      );
      await action(
        inspector,
        "UC-07",
        {
          round_id: round,
          is_single_certify: true,
          co_inspector_id: "EMP0004",
        },
        undefined,
        422,
      );
      await action(inspector, "UC-07", {
        round_id: round,
        is_single_certify: false,
        co_inspector_id: "EMP0004",
      });
    },
  );
  await check("UC08 ready for sale", async () => {
    await action(inspector, "UC-08", { unit_id: unit });
    assert.equal(
      (await row("SELECT status FROM property_unit WHERE unit_id=?", [unit]))
        .status,
      "READY_TO_SELL",
    );
  });
  await check("UC09 bind customer and store only token digest", async () => {
    link = await action(sales, "UC-09", {
      unit_id: unit,
      id_card_no: "9000000000001",
      full_name: "ลูกค้าทดสอบ สมมติ",
      phone_number: "0800000001",
      email: "test@example.com",
    });
    const token = new URLSearchParams(new URL(link.url).hash.slice(1)).get(
        "token",
      ),
      r = await row(
        "SELECT token,TIMESTAMPDIFF(SECOND,created_at,expires_at) age FROM access_link WHERE link_id=?",
        [link.link_id],
      );
    assert.equal(
      r.token,
      crypto.createHash("sha256").update(token).digest("hex"),
    );
    assert.equal(r.age, 30 * 86400);
    const exchange = await http("/api/auth/access", { data: { token } });
    assert.equal(exchange.status, 200);
    customer = exchange.cookie;
  });
  await check("AUTH-05 wrong-house workspace resources blocked", async () => {
    assert.equal(
      (await http("/api/workspace?unit=H0006", { cookie: customer })).status,
      404,
    );
    const token = fixture.links.find((l) => l.link_id === "LNK000001").token;
    const r = await http("/api/auth/access", { data: { token } });
    assert.equal(r.status, 200);
    cookieOther = r.cookie;
    const f = await row("SELECT file_url FROM file WHERE defect_id=? LIMIT 1", [
      defect,
    ]);
    assert.equal(
      (await http(new URL(f.file_url).pathname, { cookie: cookieOther }))
        .status,
      404,
    );
    assert.equal((await http(new URL(f.file_url).pathname)).status, 401);
  });
  await check(
    "UC11 customer inspection request and duplicate prevented",
    async () => {
      request = (
        await action(customer, "UC-11", { preferred_date: "2026-11-14" })
      ).request_id;
      await action(
        customer,
        "UC-11",
        { preferred_date: "2026-11-14" },
        undefined,
        409,
      );
    },
  );
  await check(
    "UC13 arrival needs appointment; reschedule same request",
    async () => {
      await action(
        sales,
        "UC-13",
        { request_id: request, mode: "arrival" },
        undefined,
        409,
      );
      for (const appointment of [
        "2026-11-14T02:00:00Z",
        "2026-11-15T02:00:00Z",
      ])
        await action(sales, "UC-13", {
          request_id: request,
          mode: "appointment",
          appointment,
        });
      handRound = (
        await action(sales, "UC-13", { request_id: request, mode: "arrival" })
      ).round_id;
      await action(
        sales,
        "UC-13",
        { request_id: request, mode: "arrival" },
        undefined,
        409,
      );
      assert.equal(
        (await row("SELECT status FROM property_unit WHERE unit_id=?", [unit]))
          .status,
        "IN_INSPECTION",
      );
    },
  );
  await check("UC14 external reporter photo and server ownership", async () => {
    handDefect = (
      await action(
        customer,
        "UC-14",
        {
          unit_id: "H0006",
          reported_by_type: "EXTERNAL",
          location_pin: "ห้องครัว จุดทดสอบ",
        },
        [picture()],
      )
    ).defect_id;
    assert.equal(
      (await row("SELECT round_id FROM defect WHERE defect_id=?", [handDefect]))
        .round_id,
      handRound,
    );
  });
  await check("UC15 head only classifies", async () => {
    await action(
      inspector,
      "UC-15",
      { defect_id: handDefect, category: "ELECTRICAL" },
      undefined,
      403,
    );
    await action(head, "UC-15", {
      defect_id: handDefect,
      category: "ELECTRICAL",
      target_date: "2026-11-16",
    });
    await action(head, "UC-03", { defect_ids: [handDefect] });
  });
  await check(
    "UC16 refuses incomplete repairs; UC17 refuses early acceptance",
    async () => {
      await action(
        inspector,
        "UC-16",
        { round_id: handRound, title: "สรุปทดสอบ" },
        undefined,
        409,
      );
      await action(customer, "UC-17", { accept: true }, undefined, 409);
    },
  );
  await check(
    "UC04 handover repair and UC16 genuine portrait PDF",
    async () => {
      await action(head, "UC-04", { defect_id: handDefect }, [picture()]);
      const r = await action(inspector, "UC-16", {
        round_id: handRound,
        title: "สรุปการซ่อม ข้อมูลทดสอบสมมติ",
      });
      const pdf = await http(r.path, { cookie: customer });
      assert.equal(pdf.status, 200);
      assert(pdf.body.subarray(0, 5).toString() === "%PDF-");
      fs.writeFileSync(
        path.join(evidence, "runtime-synthetic-report.pdf"),
        pdf.body,
      );
      assert.equal((await http(r.path, { cookie: cookieOther })).status, 404);
    },
  );
  await check(
    "UC17 rejection needs reason and rejects foreign point atomically",
    async () => {
      await action(
        customer,
        "UC-17",
        { accept: false, defect_ids: [handDefect], accept_reason: "" },
        undefined,
        422,
      );
      await action(
        customer,
        "UC-17",
        {
          accept: false,
          defect_ids: [handDefect, defect],
          accept_reason: "ทดสอบ",
        },
        undefined,
        409,
      );
      assert.equal(
        (await row("SELECT status FROM defect WHERE defect_id=?", [handDefect]))
          .status,
        "FIXED",
      );
    },
  );
  await check(
    "UC17 rejection rework stays in progress then acceptance atomic",
    async () => {
      await action(customer, "UC-17", {
        accept: false,
        defect_ids: [handDefect],
        accept_reason: "ยังไม่เรียบร้อย (สมมติ)",
      });
      assert.equal(
        (
          await row(
            "SELECT status FROM inspection_request WHERE request_id=?",
            [request],
          )
        ).status,
        "IN_PROGRESS",
      );
      await action(head, "UC-04", { defect_id: handDefect }, [picture()]);
      const rs = await Promise.all([
        http("/api/actions/UC-17", {
          cookie: customer,
          data: { accept: true },
        }),
        http("/api/actions/UC-17", {
          cookie: customer,
          data: { accept: true },
        }),
      ]);
      assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
      assert.equal(
        (
          await row("SELECT status FROM inspection_round WHERE round_id=?", [
            handRound,
          ])
        ).status,
        "CLOSED",
      );
      assert.equal(
        (await row("SELECT status FROM property_unit WHERE unit_id=?", [unit]))
          .status,
        "READY_HANDOVER",
      );
    },
  );
  await check("UC18 blank signature rejected", async () => {
    const blank = await sharp({
      create: { width: 200, height: 80, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await action(
      customer,
      "UC-18",
      {},
      [new File([blank], "blank.png", { type: "image/png" })],
      422,
    );
  });
  await check("UC18 concurrent signature persisted only once", async () => {
    const rs = await Promise.all([
      http("/api/actions/UC-18", {
        cookie: customer,
        data: {},
        files: [picture()],
      }),
      http("/api/actions/UC-18", {
        cookie: customer,
        data: {},
        files: [picture()],
      }),
    ]);
    assert(rs.every((r) => r.status === 200));
    assert.equal(
      (
        await row(
          "SELECT COUNT(*) n FROM file WHERE unit_id=? AND file_usage='SIGNATURE'",
          [unit],
        )
      ).n,
      1,
    );
    const f = await row(
      "SELECT file_url FROM file WHERE unit_id=? AND file_usage='SIGNATURE'",
      [unit],
    );
    assert.equal(
      (
        await http(new URL(f.file_url).pathname, { cookie: customer })
      ).headers.get("content-type"),
      "image/webp",
    );
    assert.equal(
      (await row("SELECT status FROM property_unit WHERE unit_id=?", [unit]))
        .status,
      "HANDED_OVER",
    );
  });
  await check("UC02 zero defect QC and single certification", async () => {
    const u = (
      await action(sales, "UC-01", {
        project_name: project,
        house_no: "TEST-ZERO",
      })
    ).unit_id;
    const r = (await action(inspector, "UC-02", { mode: "finish", unit_id: u }))
      .round_id;
    await action(inspector, "UC-06", {
      round_id: r,
      mode: "schedule",
      recheck_date: "2026-11-15",
    });
    await action(inspector, "UC-06", {
      round_id: r,
      mode: "result",
      recheck_result: "NO_DEFECT",
    });
    await action(inspector, "UC-07", { round_id: r, is_single_certify: true });
    await action(inspector, "UC-08", { unit_id: u });
  });
  await check(
    "UC10 no inspection direct signature without request round",
    async () => {
      await action(cookieOther, "UC-10", { wants_inspection: false });
      await action(cookieOther, "UC-18", {}, [picture()]);
      assert.equal(
        (
          await row(
            "SELECT COUNT(*) n FROM inspection_request WHERE unit_id='H0004'",
          )
        ).n,
        0,
      );
      assert.equal(
        (await row("SELECT status FROM property_unit WHERE unit_id='H0004'"))
          .status,
        "HANDED_OVER",
      );
    },
  );
  await check("UC12 sales submits on behalf of customer", async () => {
    await action(
      sales,
      "UC-12",
      { unit_id: "H0003", preferred_date: "2026-11-15" },
      undefined,
      409,
    );
    const l = await action(sales, "UC-09", {
      unit_id: "H0003",
      id_card_no: "9000000000002",
      full_name: "ลูกค้าสมมติ สอง",
      phone_number: "0800000002",
    });
    assert(l.url);
    const r = await action(sales, "UC-12", {
      unit_id: "H0003",
      preferred_date: "2026-11-15",
    });
    assert.equal(
      (
        await row(
          "SELECT requested_by FROM inspection_request WHERE request_id=?",
          [r.request_id],
        )
      ).requested_by,
      "EMP0001",
    );
  });
  await check(
    "AUTH-06 expiry revocation and logout replay denied",
    async () => {
      const tmp = await login("EMP0002");
      await http("/api/auth/logout", { cookie: tmp, method: "POST" });
      assert.equal((await http("/api/workspace", { cookie: tmp })).status, 401);
      await db.query(
        "UPDATE access_link SET created_at=DATE_SUB(NOW(),INTERVAL 2 DAY),expires_at=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE link_id=?",
        [link.link_id],
      );
      assert.equal(
        (await http("/api/workspace", { cookie: customer })).status,
        401,
      );
      const token = new URLSearchParams(new URL(link.url).hash.slice(1)).get(
        "token",
      );
      assert.equal(
        (await http("/api/auth/access", { data: { token } })).status,
        401,
      );
      await db.query(
        "UPDATE employee SET is_active=0 WHERE employee_id='EMP0001'",
      );
      assert.equal(
        (await http("/api/workspace", { cookie: sales })).status,
        401,
      );
    },
  );
  await check("AUTH-07 wrong password throttled", async () => {
    for (let i = 0; i < 5; i++)
      assert.equal(
        (
          await http("/api/auth/login", {
            data: { employee_id: "EMP0010", password: "bad" },
          })
        ).status,
        401,
      );
    assert.equal(
      (
        await http("/api/auth/login", {
          data: { employee_id: "EMP0010", password: "bad" },
        })
      ).status,
      429,
    );
  });
  await check(
    "FILES no staging orphans after rejected transactions",
    async () => {
      const dir = path.join(local, "test-storage/staging");
      assert.equal(fs.readdirSync(dir).length, 0);
      const [files] = await db.query("SELECT file_url FROM file");
      const valid = new Set(files.map((f) => path.basename(f.file_url)));
      const stored = fs.readdirSync(path.join(local, "test-storage/files"));
      assert(stored.every((f) => valid.has(f)));
    },
  );
} catch (e) {
  result.fatal = e.message;
  console.error("FAILED", e.message);
} finally {
  await db.end();
  result.finished_at = new Date().toISOString();
  result.status = result.fatal ? "FAIL" : "PASS";
  fs.writeFileSync(
    path.join(evidence, "runtime-integration.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      status: result.status,
      cases: result.cases.length,
      fatal: result.fatal,
    }),
  );
  if (result.fatal) process.exitCode = 1;
}
