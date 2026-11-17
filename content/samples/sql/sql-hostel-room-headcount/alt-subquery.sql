SELECT room_no, block, staying, capacity - staying AS free_beds
FROM (
  SELECT r.room_no, r.block, r.capacity,
         (SELECT COUNT(*)
          FROM allotments AS a
          WHERE a.room_no = r.room_no
            AND a.checked_out_on IS NULL) AS staying
  FROM rooms AS r
)
ORDER BY block, room_no;
