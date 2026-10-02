-- Proctoring v2 (docs/PREP-TRACKER.md plan row 85): what the browser reports
-- now includes the screen share stopping and starting again, a second screen
-- connected, and speech or noise heard. Kinds of event only: nothing of the
-- screen or the sound is stored.
ALTER TABLE proctor_events DROP CONSTRAINT IF EXISTS proctor_events_kind_check;
ALTER TABLE proctor_events ADD CONSTRAINT proctor_events_kind_check
  CHECK (kind IN ('tab_hidden', 'fullscreen_exit', 'copy', 'paste', 'camera_off', 'camera_on',
                  'screen_share_off', 'screen_share_on', 'second_screen', 'voice'));
