WITH late AS (
  SELECT member,
         CAST(julianday(COALESCE(returned_on, '2026-11-17')) - julianday(due_on) AS INTEGER) AS days
  FROM loans
)
SELECT member,
       COUNT(*) AS late_loans,
       SUM(days) * 5 AS fine
FROM late
WHERE days > 0
GROUP BY member
ORDER BY fine DESC, member ASC;
