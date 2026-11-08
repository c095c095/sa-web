-- P1 CANDIDATE: MariaDB 10.11.16 adaptation of approved SA contract v0.3.3.
-- Original PostgreSQL file is unchanged. Includes proposed AM-01/AM-05/AM-06, pending G1.
-- A scratch migration proof, not a production migration or a new SA source of truth.
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ---------- Enums ----------

-- ---------- ID sequences (human-readable codes) ----------
CREATE SEQUENCE seq_employee START WITH 1 MAXVALUE 9999 NOCYCLE; CREATE SEQUENCE seq_customer START WITH 1 MAXVALUE 9999 NOCYCLE; CREATE SEQUENCE seq_unit START WITH 1 MAXVALUE 9999 NOCYCLE;
CREATE SEQUENCE seq_round START WITH 1 MAXVALUE 9999 NOCYCLE;    CREATE SEQUENCE seq_request START WITH 1 MAXVALUE 999999 NOCYCLE;  CREATE SEQUENCE seq_defect START WITH 1 MAXVALUE 99999 NOCYCLE;
CREATE SEQUENCE seq_file START WITH 1 MAXVALUE 999999 NOCYCLE;     CREATE SEQUENCE seq_report START WITH 1 MAXVALUE 99999 NOCYCLE;   CREATE SEQUENCE seq_link START WITH 1 MAXVALUE 999999 NOCYCLE;

-- T01 employee (master data: seeded, no UC creates it — GAP-12)
CREATE TABLE employee (
  employee_id    VARCHAR(12)  PRIMARY KEY DEFAULT (CONCAT('EMP', LPAD(NEXT VALUE FOR seq_employee, 4, '0'))),
  full_name      VARCHAR(100) NOT NULL CHECK (length(trim(full_name)) > 0),
  phone_number   VARCHAR(15)  NOT NULL CHECK (phone_number REGEXP '^0[0-9]{8,9}$'),
  email          VARCHAR(100) NULL     CHECK (email IS NULL OR email REGEXP '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
  role           ENUM('SALES','INSPECTOR','TECHNICIAN','HEAD_TECHNICIAN') NOT NULL,
  craft_category ENUM('CEILING','ELECTRICAL','PLUMBING','WALL','FLOOR','DOOR_WINDOW') NULL,
  password_hash  VARCHAR(255) NOT NULL,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  CONSTRAINT ck_employee_craft CHECK (
       (role = 'TECHNICIAN' AND craft_category IS NOT NULL)
    OR (role = 'HEAD_TECHNICIAN')                       -- head tech may cover all crafts (NULL) or one
    OR (role IN ('SALES','INSPECTOR') AND craft_category IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- T02 customer
CREATE TABLE customer (
  customer_id  VARCHAR(12)  PRIMARY KEY DEFAULT (CONCAT('CUS', LPAD(NEXT VALUE FOR seq_customer, 4, '0'))),
  id_card_no   CHAR(13)     NOT NULL UNIQUE CHECK (id_card_no REGEXP '^[0-9]{13}$'),
  full_name    VARCHAR(100) NOT NULL CHECK (length(trim(full_name)) > 0),
  phone_number VARCHAR(15)  NOT NULL CHECK (phone_number REGEXP '^0[0-9]{8,9}$'),
  email        VARCHAR(100) NULL     CHECK (email IS NULL OR email REGEXP '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- T03 property_unit
CREATE TABLE property_unit (
  unit_id        VARCHAR(12)  PRIMARY KEY DEFAULT (CONCAT('H', LPAD(NEXT VALUE FOR seq_unit, 4, '0'))),
  project_name   VARCHAR(100) NOT NULL CHECK (length(trim(project_name)) > 0),
  house_no       VARCHAR(20)  NOT NULL CHECK (length(trim(house_no)) > 0),
  unit_type      VARCHAR(50)  NULL,
  status         ENUM('IN_QC','READY_TO_SELL','CONTRACTED','WAITING_INSPECTION','IN_INSPECTION','READY_HANDOVER','HANDED_OVER')  NOT NULL DEFAULT 'IN_QC',
  customer_id    VARCHAR(12)  NULL REFERENCES customer(customer_id),
  registered_by  VARCHAR(12)  NOT NULL REFERENCES employee(employee_id),
  created_at     DATETIME(6)    NOT NULL DEFAULT now(),
  handed_over_at DATETIME(6)    NULL,
  CONSTRAINT uq_unit_project_house UNIQUE (project_name, house_no),
  CONSTRAINT ck_unit_customer CHECK (status IN ('IN_QC','READY_TO_SELL') OR customer_id IS NOT NULL),
  CONSTRAINT ck_unit_handover CHECK ((status = 'HANDED_OVER') = (handed_over_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- T05 inspection_request (before T04 because T04 references it)
CREATE TABLE inspection_request (
  request_id     VARCHAR(12) PRIMARY KEY DEFAULT (CONCAT('REQ', LPAD(NEXT VALUE FOR seq_request, 6, '0'))),
  unit_id        VARCHAR(12) NOT NULL REFERENCES property_unit(unit_id),
  customer_id    VARCHAR(12) NOT NULL REFERENCES customer(customer_id),
  requested_by   VARCHAR(12) NULL REFERENCES employee(employee_id),   -- NULL = customer submitted (UC-11); set = sales on behalf (UC-12)
  preferred_date DATE        NOT NULL,
  appointment    DATETIME(6)   NULL,
  arrival        DATETIME(6)   NULL,
  status         ENUM('SUBMITTED','IN_PROGRESS','COMPLETED') NOT NULL DEFAULT 'SUBMITTED',
  accept_result  ENUM('ACCEPTED','REJECTED')  NULL,
  accept_reason  TEXT        NULL,
  accepted_at    DATETIME(6)   NULL,
  created_at     DATETIME(6)   NOT NULL DEFAULT now(),
  CONSTRAINT ck_req_reject_reason CHECK (NOT (accept_result <=> 'REJECTED') OR accept_reason IS NOT NULL),
  CONSTRAINT ck_req_completed     CHECK (status <> 'COMPLETED' OR (accept_result IS NOT NULL AND accept_result = 'ACCEPTED')),
  CONSTRAINT ck_req_in_progress   CHECK (status = 'SUBMITTED' OR arrival IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- T04 inspection_round
CREATE TABLE inspection_round (
  round_id          VARCHAR(12) PRIMARY KEY DEFAULT (CONCAT('RND', LPAD(NEXT VALUE FOR seq_round, 4, '0'))),
  unit_id           VARCHAR(12) NOT NULL REFERENCES property_unit(unit_id),
  round_type        ENUM('QC_INTERNAL','CUSTOMER_HANDOVER')  NOT NULL,
  request_id        VARCHAR(12) NULL UNIQUE REFERENCES inspection_request(request_id),  -- 1 request : 0..1 round
  inspector_id      VARCHAR(12) NULL REFERENCES employee(employee_id),
  co_inspector_id   VARCHAR(12) NULL REFERENCES employee(employee_id),
  is_single_certify BOOLEAN     NOT NULL DEFAULT FALSE,
  recheck_date      DATE        NULL,
  recheck_result    ENUM('DEFECT_FOUND','NO_DEFECT') NULL,
  inspection_finished_at DATETIME(6) NULL,
  status            ENUM('OPEN','RECHECK_SCHEDULED','CLOSED') NOT NULL DEFAULT 'OPEN',
  started_at        DATETIME(6)   NOT NULL DEFAULT now(),
  closed_at         DATETIME(6)   NULL,
  CONSTRAINT ck_round_type_link CHECK (
       (round_type = 'QC_INTERNAL'       AND request_id IS NULL AND inspector_id IS NOT NULL)
    OR (round_type = 'CUSTOMER_HANDOVER' AND request_id IS NOT NULL)),
  CONSTRAINT ck_round_coinspector CHECK (co_inspector_id IS NULL OR (inspector_id IS NOT NULL AND co_inspector_id <> inspector_id)),
  CONSTRAINT ck_round_closed_at   CHECK ((status = 'CLOSED') = (closed_at IS NOT NULL)),
  CONSTRAINT ck_round_qc_certify  CHECK (
       round_type <> 'QC_INTERNAL' OR status <> 'CLOSED'
    OR (recheck_result IS NOT NULL AND recheck_result = 'NO_DEFECT' AND ((co_inspector_id IS NOT NULL) <> is_single_certify)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- at most one active (not CLOSED) round per unit per type
ALTER TABLE inspection_round ADD COLUMN active_round_marker TINYINT GENERATED ALWAYS AS (CASE WHEN status <> 'CLOSED' THEN 1 ELSE NULL END) PERSISTENT, ADD UNIQUE KEY uq_round_active (unit_id, round_type, active_round_marker);

-- T06 defect
CREATE TABLE defect (
  defect_id            VARCHAR(12) PRIMARY KEY DEFAULT (CONCAT('DEF', DATE_FORMAT(CURRENT_TIMESTAMP, '%Y'), LPAD(NEXT VALUE FOR seq_defect, 5, '0'))),
  round_id             VARCHAR(12) NOT NULL REFERENCES inspection_round(round_id),
  category             ENUM('CEILING','ELECTRICAL','PLUMBING','WALL','FLOOR','DOOR_WINDOW') NULL,
  description          TEXT        NULL,
  location_pin         VARCHAR(100) NOT NULL CHECK (length(trim(location_pin)) > 0),
  status               ENUM('NEW','WAITING_ASSIGN','ASSIGNED','FIXED','REWORK','VERIFIED') NOT NULL,
  reported_by_type     ENUM('INSPECTOR','CUSTOMER','EXTERNAL') NOT NULL,
  reported_by_employee VARCHAR(12) NULL REFERENCES employee(employee_id),
  technician_id        VARCHAR(12) NULL REFERENCES employee(employee_id),
  assigned_by          VARCHAR(12) NULL REFERENCES employee(employee_id),
  assigned_date        DATETIME(6)   NULL,
  target_date          DATE        NULL,
  completed_date       DATETIME(6)   NULL,
  verified_by          VARCHAR(12) NULL REFERENCES employee(employee_id),
  verified_at          DATETIME(6)   NULL,
  rework_count         SMALLINT    NOT NULL DEFAULT 0 CHECK (rework_count >= 0),
  created_at           DATETIME(6)   NOT NULL DEFAULT now(),
  CONSTRAINT ck_defect_category CHECK (status = 'NEW' OR category IS NOT NULL),
  CONSTRAINT ck_defect_reporter CHECK (
       (reported_by_type = 'INSPECTOR' AND reported_by_employee IS NOT NULL)
    OR (reported_by_type IN ('CUSTOMER','EXTERNAL') AND reported_by_employee IS NULL)),
  CONSTRAINT ck_defect_assigned CHECK (status NOT IN ('ASSIGNED','FIXED','REWORK','VERIFIED') OR technician_id IS NOT NULL),
  CONSTRAINT ck_defect_verified CHECK ((status = 'VERIFIED') = (verified_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- T08 repair_report
CREATE TABLE repair_report (
  report_id  VARCHAR(12)  PRIMARY KEY DEFAULT (CONCAT('RPT', LPAD(NEXT VALUE FOR seq_report, 5, '0'))),
  round_id   VARCHAR(12)  NOT NULL REFERENCES inspection_round(round_id),
  created_by VARCHAR(12)  NOT NULL REFERENCES employee(employee_id),
  title      VARCHAR(100) NOT NULL CHECK (length(trim(title)) > 0),
  created_at DATETIME(6)    NOT NULL DEFAULT now()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- T07 file
CREATE TABLE file (
  file_id     VARCHAR(12)  PRIMARY KEY DEFAULT (CONCAT('FIL', LPAD(NEXT VALUE FOR seq_file, 6, '0'))),
  unit_id     VARCHAR(12)  NULL REFERENCES property_unit(unit_id),
  defect_id   VARCHAR(12)  NULL REFERENCES defect(defect_id) ON DELETE CASCADE,
  report_id   VARCHAR(12)  NULL REFERENCES repair_report(report_id),
  file_url    VARCHAR(255) NOT NULL CHECK (file_url REGEXP '^https?://'),
  file_usage  ENUM('BEFORE_FIX','AFTER_FIX','SUMMARY_PDF','SIGNATURE')   NOT NULL,
  uploaded_at DATETIME(6)    NOT NULL DEFAULT now(),
  CONSTRAINT ck_file_one_owner CHECK (((unit_id IS NOT NULL) + (defect_id IS NOT NULL) + (report_id IS NOT NULL)) = 1),
  CONSTRAINT ck_file_usage_owner CHECK (
       (file_usage IN ('BEFORE_FIX','AFTER_FIX') AND defect_id IS NOT NULL)
    OR (file_usage = 'SUMMARY_PDF' AND report_id IS NOT NULL)
    OR (file_usage = 'SIGNATURE'   AND unit_id   IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE file ADD COLUMN signature_owner VARCHAR(12) GENERATED ALWAYS AS (CASE WHEN file_usage = 'SIGNATURE' THEN unit_id ELSE NULL END) PERSISTENT, ADD UNIQUE KEY uq_file_one_signature (signature_owner);

-- T09 access_link
CREATE TABLE access_link (
  link_id     VARCHAR(12) PRIMARY KEY DEFAULT (CONCAT('LNK', LPAD(NEXT VALUE FOR seq_link, 6, '0'))),
  unit_id     VARCHAR(12) NOT NULL REFERENCES property_unit(unit_id),
  customer_id VARCHAR(12) NOT NULL REFERENCES customer(customer_id),
  token       VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE CHECK (length(token) >= 32),
  expires_at  DATETIME(6)   NOT NULL,
  created_by  VARCHAR(12) NOT NULL REFERENCES employee(employee_id),
  created_at  DATETIME(6)   NOT NULL DEFAULT now(),
  CONSTRAINT ck_link_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
