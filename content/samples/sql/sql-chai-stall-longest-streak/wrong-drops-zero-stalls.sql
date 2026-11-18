WITH good AS (
  SELECT stall, sold_on,
         julianday(sold_on) - ROW_NUMBER() OVER (PARTITION BY stall ORDER BY sold_on) AS grp
  FROM sales
  WHERE cups >= 50
),
runs AS (
  SELECT stall, COUNT(*) AS streak_days, MIN(sold_on) AS streak_start, MAX(sold_on) AS streak_end
  FROM good
  GROUP BY stall, grp
),
best AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY stall ORDER BY streak_days DESC, streak_start) AS pick
  FROM runs
)
SELECT stall, streak_days, streak_start, streak_end
FROM best
WHERE pick = 1
ORDER BY streak_days DESC, stall;
