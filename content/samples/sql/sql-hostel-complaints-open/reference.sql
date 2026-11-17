WITH ranked AS (
  SELECT complaint_id, status, updated_at,
         ROW_NUMBER() OVER (
           PARTITION BY complaint_id
           ORDER BY updated_at DESC, update_id DESC
         ) AS rn
  FROM updates
)
SELECT c.complaint_id,
       c.room_no,
       COALESCE(r.status, 'new') AS current_status,
       r.updated_at AS last_update
FROM complaints AS c
LEFT JOIN ranked AS r
  ON r.complaint_id = c.complaint_id
 AND r.rn = 1
WHERE COALESCE(r.status, 'new') <> 'resolved'
ORDER BY c.complaint_id;
