SELECT s.branch, s.roll_no, s.name, s.score,
       1 + (SELECT COUNT(DISTINCT t.score)
            FROM scores AS t
            WHERE t.branch = s.branch AND t.score > s.score) AS rank_in_branch
FROM scores AS s
WHERE s.score IS NOT NULL
  AND (SELECT COUNT(DISTINCT t.score)
       FROM scores AS t
       WHERE t.branch = s.branch AND t.score > s.score) < 2
ORDER BY s.branch, rank_in_branch, s.roll_no;
