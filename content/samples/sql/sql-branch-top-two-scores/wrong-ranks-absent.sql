SELECT branch, roll_no, name, score, rnk AS rank_in_branch
FROM (
  SELECT branch, roll_no, name, score,
         DENSE_RANK() OVER (PARTITION BY branch ORDER BY score DESC) AS rnk
  FROM scores
)
WHERE rnk <= 2
ORDER BY branch, rank_in_branch, roll_no;
