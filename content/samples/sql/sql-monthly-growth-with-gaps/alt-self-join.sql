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
filled AS (
  SELECT months.m,
         (SELECT COALESCE(SUM(p.pages * p.rate), 0)
          FROM prints AS p
          WHERE p.printed_on >= months.m
            AND p.printed_on < date(months.m, '+1 month')) AS revenue
  FROM months
)
SELECT strftime('%Y-%m', f.m) AS month,
       f.revenue,
       CASE WHEN prev.revenue > 0
            THEN ROUND(100.0 * (f.revenue - prev.revenue) / prev.revenue, 1)
       END AS growth_pct
FROM filled AS f
LEFT JOIN filled AS prev ON prev.m = date(f.m, '-1 month')
ORDER BY f.m;
