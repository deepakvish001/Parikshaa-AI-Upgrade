WITH RECURSIVE
bounds AS (
  SELECT date(MIN(printed_on), 'start of month') AS first_m,
         date(MAX(printed_on), 'start of month') AS last_m
  FROM prints
),
months(m) AS (
  SELECT first_m FROM bounds WHERE first_m IS NOT NULL
  UNION ALL
  SELECT date(m, '+1 month') FROM months, bounds WHERE m < last_m
),
totals AS (
  SELECT strftime('%m', printed_on) AS mm, SUM(pages * rate) AS revenue
  FROM prints
  GROUP BY strftime('%m', printed_on)
),
filled AS (
  SELECT months.m, COALESCE(totals.revenue, 0) AS revenue
  FROM months LEFT JOIN totals ON totals.mm = strftime('%m', months.m)
)
SELECT strftime('%Y-%m', m) AS month,
       revenue,
       CASE WHEN LAG(revenue) OVER (ORDER BY m) > 0
            THEN ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY m)) / LAG(revenue) OVER (ORDER BY m), 1)
       END AS growth_pct
FROM filled
ORDER BY m;
