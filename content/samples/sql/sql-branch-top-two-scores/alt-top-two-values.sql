WITH tops AS (
  SELECT branch, score,
         (SELECT COUNT(DISTINCT u.score) FROM scores AS u
          WHERE u.branch = d.branch AND u.score > d.score) + 1 AS rnk
  FROM (SELECT DISTINCT branch, score FROM scores WHERE score IS NOT NULL) AS d
)
SELECT s.branch, s.roll_no, s.name, s.score, t.rnk AS rank_in_branch
FROM scores AS s
JOIN tops AS t ON t.branch = s.branch AND t.score = s.score
WHERE t.rnk <= 2
ORDER BY s.branch, rank_in_branch, s.roll_no;
