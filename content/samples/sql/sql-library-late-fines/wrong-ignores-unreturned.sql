SELECT member,
       COUNT(*) AS late_loans,
       CAST(SUM(julianday(returned_on) - julianday(due_on)) AS INTEGER) * 5 AS fine
FROM loans
WHERE julianday(returned_on) > julianday(due_on)
GROUP BY member
ORDER BY fine DESC, member;
