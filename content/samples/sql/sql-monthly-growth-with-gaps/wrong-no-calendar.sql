WITH totals AS (
  SELECT date(printed_on, 'start of month') AS m, SUM(pages * rate) AS revenue
  FROM prints
  GROUP BY date(printed_on, 'start of month')
)
SELECT strftime('%Y-%m', m) AS month,
       revenue,
       CASE WHEN LAG(revenue) OVER (ORDER BY m) > 0
            THEN ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY m)) / LAG(revenue) OVER (ORDER BY m), 1)
       END AS growth_pct
FROM totals
ORDER BY m;
