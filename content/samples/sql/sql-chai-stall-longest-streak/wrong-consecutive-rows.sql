WITH marked AS (
  SELECT stall, sold_on, cups,
         ROW_NUMBER() OVER (PARTITION BY stall ORDER BY sold_on)
       - ROW_NUMBER() OVER (PARTITION BY stall, (cups >= 50) ORDER BY sold_on) AS grp
  FROM sales
),
runs AS (
  SELECT stall, COUNT(*) AS streak_days, MIN(sold_on) AS streak_start, MAX(sold_on) AS streak_end
  FROM marked
  WHERE cups >= 50
  GROUP BY stall, grp
),
best AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY stall ORDER BY streak_days DESC, streak_start) AS pick
  FROM runs
)
SELECT s.stall, COALESCE(b.streak_days, 0) AS streak_days, b.streak_start, b.streak_end
FROM stalls AS s
LEFT JOIN best AS b ON b.stall = s.stall AND b.pick = 1
ORDER BY streak_days DESC, s.stall;
