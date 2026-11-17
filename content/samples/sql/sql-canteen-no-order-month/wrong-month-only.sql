SELECT s.student_id, s.name
FROM students AS s
LEFT JOIN orders AS o
  ON o.student_id = s.student_id
 AND strftime('%m', o.ordered_on) = '11'
WHERE o.order_id IS NULL
ORDER BY s.student_id;
