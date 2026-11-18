SELECT r.room_no, r.block,
       COUNT(a.allot_id) AS staying,
       r.capacity - COUNT(a.allot_id) AS free_beds
FROM rooms AS r
LEFT JOIN allotments AS a ON a.room_no = r.room_no
WHERE a.checked_out_on IS NULL
GROUP BY r.room_no, r.block, r.capacity
ORDER BY r.block, r.room_no;
