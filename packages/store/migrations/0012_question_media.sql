-- Pictures in questions and passages: diagrams, figure series, charts to read
-- from. Stored once per organisation under the SHA-256 of their bytes; an exam
-- or a bank question names a picture by that hash only.

CREATE TABLE question_media (
  org_id      text        NOT NULL REFERENCES organisations (id),
  sha256      char(64)    NOT NULL,
  mime        text        NOT NULL CHECK (mime IN ('image/png', 'image/jpeg', 'image/gif', 'image/webp')),
  bytes       bytea       NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, sha256)
);

ALTER TABLE question_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON question_media AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY question_media_staff ON question_media
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');
GRANT SELECT, INSERT ON question_media TO parikshaa_app;

-- Served to anyone who asks by hash, with no session: an <img> cannot send
-- one, and a hash can only be known by someone who already has the picture
-- (or the exam that names it). Nothing else about the row is readable this way.
CREATE FUNCTION question_media_by_hash(wanted char(64)) RETURNS TABLE (mime text, bytes bytea)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT mime, bytes FROM question_media WHERE sha256 = wanted LIMIT 1 $$;
REVOKE ALL ON FUNCTION question_media_by_hash(char) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION question_media_by_hash(char) TO parikshaa_app;
