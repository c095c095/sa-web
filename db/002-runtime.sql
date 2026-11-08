-- G1 approved AM-04: one technical session table, business entities unchanged.
CREATE TABLE IF NOT EXISTS app_session (
  session_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  session_kind ENUM('EMPLOYEE','CUSTOMER') NOT NULL,
  employee_id VARCHAR(12) NULL REFERENCES employee(employee_id),
  link_id VARCHAR(12) NULL REFERENCES access_link(link_id),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  expires_at DATETIME(6) NOT NULL,
  revoked_at DATETIME(6) NULL,
  CHECK ((session_kind='EMPLOYEE' AND employee_id IS NOT NULL AND link_id IS NULL) OR (session_kind='CUSTOMER' AND employee_id IS NULL AND link_id IS NOT NULL)),
  CHECK (expires_at > created_at),
  INDEX ix_session_expiry(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
