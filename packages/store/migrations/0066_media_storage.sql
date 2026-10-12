-- Proctoring photos in object storage (docs/F1-GO-LIVE-PLAN.md §8.2, G0).
--
-- A photo's bytes go to a bucket (Supabase Storage in production) instead of
-- this table; the row keeps everything else, and the object's key. The bytes
-- are sealed under the attempt's data key before they leave the server, so the
-- bucket holds ciphertext only: neither the storage provider nor anyone with
-- the bucket's key can see a photo. Rows from before stay as they were, with
-- their bytes here, until `npm run media-move` carries them over.
ALTER TABLE proctor_media ALTER COLUMN sealed DROP NOT NULL;
ALTER TABLE proctor_media ADD COLUMN object_key text;
ALTER TABLE proctor_media ADD CONSTRAINT proctor_media_bytes_once CHECK ((sealed IS NULL) <> (object_key IS NULL));

-- The move: bytes out of the row, the key in, one photo at a time.
GRANT UPDATE (sealed, object_key) ON proctor_media TO parikshaa_app;

-- Objects whose rows are gone (an attempt erased). Erasing the attempt's key
-- already made them unreadable; the retention sweep deletes them from the
-- bucket as well, and then these rows.
CREATE TABLE media_trash (
  org_id     text        NOT NULL,
  object_key text        NOT NULL,
  trashed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, object_key)
);

ALTER TABLE media_trash ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON media_trash AS RESTRICTIVE
  USING (org_id = current_setting('parikshaa.org_id', true))
  WITH CHECK (org_id = current_setting('parikshaa.org_id', true));
CREATE POLICY media_trash_staff ON media_trash
  USING (current_setting('parikshaa.actor', true) = 'staff')
  WITH CHECK (current_setting('parikshaa.actor', true) = 'staff');

GRANT SELECT, INSERT, DELETE ON media_trash TO parikshaa_app;
