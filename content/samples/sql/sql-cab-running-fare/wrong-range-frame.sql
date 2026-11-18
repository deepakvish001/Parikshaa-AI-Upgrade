SELECT driver, trip_id, ended_at,
       fare + COALESCE(tip, 0) AS earning,
       SUM(fare + COALESCE(tip, 0)) OVER (
         PARTITION BY driver, date(ended_at)
         ORDER BY ended_at
       ) AS day_total
FROM trips
WHERE status = 'done'
ORDER BY driver, ended_at, trip_id;
