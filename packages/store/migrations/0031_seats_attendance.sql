-- Exam day in rooms (docs/PREP-TRACKER.md, V2-12: CL24, CL25, CL32, CL33).
-- Each invited candidate's centre, room and seat, printed on their admit
-- card; and who an invigilator has seen in the room, by scanning that card
-- or typing the roll number. Neither touches the ledger: a seat is where a
-- candidate sits, not what they answered.

CREATE TABLE exam_seats (
  org_id         text        NOT NULL,
  exam_id        text        NOT NULL,
  candidate_ref  text        NOT NULL,
  centre         text        NOT NULL CHECK (char_length(centre) <= 200),
  room           text        NOT NULL CHECK (char_length(room) BETWEEN 1 AND 100),
  seat           text        NOT NULL CHECK (char_length(seat) BETWEEN 1 AND 20),
  PRIMARY KEY (org_id, exam_id, candidate_ref),
  UNIQUE (org_id, exam_id, centre, room, seat)
);

CREATE TABLE exam_attendance (
  org_id         text        NOT NULL,
  exam_id        text        NOT NULL,
  candidate_ref  text        NOT NULL,
  marked_by      text        NOT NULL,
  marked_at      timestamptz NOT NULL,
  PRIMARY KEY (org_id, exam_id, candidate_ref)
);

ALTER TABLE exam_seats ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON exam_seats AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY exam_seats_staff ON exam_seats
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

ALTER TABLE exam_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON exam_attendance AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY exam_attendance_staff ON exam_attendance
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

GRANT SELECT, INSERT, UPDATE, DELETE ON exam_seats, exam_attendance TO parikshaa_app;
