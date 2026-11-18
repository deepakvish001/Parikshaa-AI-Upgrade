SELECT member,
       SUM(CASE WHEN COALESCE(returned_on, '2026-11-17') > due_on THEN 1 ELSE 0 END) AS late_loans,
       CAST(5 * SUM(MAX(0, julianday(COALESCE(returned_on, '2026-11-17')) - julianday(due_on))) AS INTEGER) AS fine
FROM loans
GROUP BY member
HAVING fine > 0
ORDER BY fine DESC, member;
