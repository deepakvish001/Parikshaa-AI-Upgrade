SELECT driver, trip_id, ended_at,
       fare + tip AS earning,
       SUM(fare + tip) OVER (
         PARTITION BY driver, date(ended_at)
         ORDER BY ended_at, trip_id
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS day_total
FROM trips
WHERE status = 'done'
ORDER BY driver, ended_at, trip_id;
