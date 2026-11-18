SELECT student_id, name FROM students
EXCEPT
SELECT s.student_id, s.name
FROM students AS s
JOIN orders AS o ON o.student_id = s.student_id
WHERE o.ordered_on LIKE '2026-11-%'
ORDER BY student_id;
