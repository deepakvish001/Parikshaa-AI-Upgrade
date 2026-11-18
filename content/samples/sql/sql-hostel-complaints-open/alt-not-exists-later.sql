SELECT c.complaint_id,
       c.room_no,
       COALESCE(u.status, 'new') AS current_status,
       u.updated_at AS last_update
FROM complaints AS c
LEFT JOIN updates AS u
  ON u.complaint_id = c.complaint_id
 AND NOT EXISTS (
   SELECT 1 FROM updates AS v
   WHERE v.complaint_id = u.complaint_id
     AND (v.updated_at > u.updated_at
          OR (v.updated_at = u.updated_at AND v.update_id > u.update_id))
 )
WHERE COALESCE(u.status, 'new') <> 'resolved'
ORDER BY c.complaint_id;
