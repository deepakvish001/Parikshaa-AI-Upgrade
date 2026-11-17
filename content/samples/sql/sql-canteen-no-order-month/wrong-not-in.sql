SELECT student_id, name
FROM students
WHERE student_id NOT IN (
  SELECT student_id FROM orders
  WHERE ordered_on BETWEEN '2026-11-01' AND '2026-11-30'
)
ORDER BY student_id;
