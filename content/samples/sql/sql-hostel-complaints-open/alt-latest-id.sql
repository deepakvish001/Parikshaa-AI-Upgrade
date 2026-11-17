SELECT c.complaint_id,
       c.room_no,
       COALESCE(u.status, 'new') AS current_status,
       u.updated_at AS last_update
FROM complaints AS c
LEFT JOIN updates AS u
  ON u.update_id = (
    SELECT u2.update_id
    FROM updates AS u2
    WHERE u2.complaint_id = c.complaint_id
    ORDER BY u2.updated_at DESC, u2.update_id DESC
    LIMIT 1
  )
WHERE COALESCE(u.status, 'new') <> 'resolved'
ORDER BY c.complaint_id;
