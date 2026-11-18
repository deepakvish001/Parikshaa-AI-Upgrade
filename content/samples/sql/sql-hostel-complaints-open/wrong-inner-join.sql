WITH ranked AS (
  SELECT complaint_id, status, updated_at,
         ROW_NUMBER() OVER (PARTITION BY complaint_id ORDER BY updated_at DESC, update_id DESC) AS rn
  FROM updates
)
SELECT c.complaint_id, c.room_no, r.status AS current_status, r.updated_at AS last_update
FROM complaints AS c
JOIN ranked AS r ON r.complaint_id = c.complaint_id AND r.rn = 1
WHERE r.status <> 'resolved'
ORDER BY c.complaint_id;
