WITH good AS (
  SELECT stall, sold_on FROM sales WHERE cups >= 50
),
starts AS (
  SELECT g.stall, g.sold_on AS day
  FROM good AS g
  WHERE NOT EXISTS (SELECT 1 FROM good AS p
                    WHERE p.stall = g.stall AND p.sold_on = date(g.sold_on, '-1 day'))
),
ends AS (
  SELECT g.stall, g.sold_on AS day
  FROM good AS g
  WHERE NOT EXISTS (SELECT 1 FROM good AS n
                    WHERE n.stall = g.stall AND n.sold_on = date(g.sold_on, '+1 day'))
),
runs AS (
  SELECT st.stall,
         st.day AS streak_start,
         (SELECT MIN(en.day) FROM ends AS en WHERE en.stall = st.stall AND en.day >= st.day) AS streak_end
  FROM starts AS st
),
measured AS (
  SELECT stall, streak_start, streak_end,
         CAST(julianday(streak_end) - julianday(streak_start) AS INTEGER) + 1 AS streak_days
  FROM runs
)
SELECT s.stall,
       COALESCE((SELECT MAX(m.streak_days) FROM measured AS m WHERE m.stall = s.stall), 0) AS streak_days,
       (SELECT m.streak_start FROM measured AS m WHERE m.stall = s.stall
        ORDER BY m.streak_days DESC, m.streak_start LIMIT 1) AS streak_start,
       (SELECT m.streak_end FROM measured AS m WHERE m.stall = s.stall
        ORDER BY m.streak_days DESC, m.streak_start LIMIT 1) AS streak_end
FROM stalls AS s
ORDER BY streak_days DESC, s.stall;
