SELECT c.complaint_id,
       c.room_no,
       COALESCE(u.status, 'new') AS current_status,
       u.updated_at AS last_update
FROM complaints AS c
LEFT JOIN (
  SELECT complaint_id, MAX(updated_at) AS last_at
  FROM updates
  GROUP BY complaint_id
) AS m ON m.complaint_id = c.complaint_id
LEFT JOIN updates AS u
  ON u.complaint_id = c.complaint_id
 AND u.updated_at = m.last_at
WHERE COALESCE(u.status, 'new') <> 'resolved'
ORDER BY c.complaint_id;
