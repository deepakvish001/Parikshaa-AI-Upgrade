SELECT branch, roll_no, name, score, rnk AS rank_in_branch
FROM (
  SELECT branch, roll_no, name, score,
         DENSE_RANK() OVER (ORDER BY score DESC) AS rnk
  FROM scores
  WHERE score IS NOT NULL
)
WHERE rnk <= 2
ORDER BY branch, rank_in_branch, roll_no;
