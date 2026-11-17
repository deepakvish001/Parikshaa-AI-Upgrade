SELECT s.student_id, s.name
FROM students AS s
LEFT JOIN orders AS o ON o.student_id = s.student_id
WHERE o.order_id IS NULL
   OR o.ordered_on NOT BETWEEN '2026-11-01' AND '2026-11-30'
ORDER BY s.student_id;
