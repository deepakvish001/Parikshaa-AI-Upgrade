SELECT s.student_id, s.name
FROM students AS s
WHERE NOT EXISTS (
  SELECT 1
  FROM orders AS o
  WHERE o.student_id = s.student_id
    AND o.ordered_on >= '2026-11-01'
    AND o.ordered_on < '2026-12-01'
)
ORDER BY s.student_id;
