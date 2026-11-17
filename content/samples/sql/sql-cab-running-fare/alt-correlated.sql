SELECT t.driver,
       t.trip_id,
       t.ended_at,
       t.fare + COALESCE(t.tip, 0) AS earning,
       (SELECT SUM(u.fare + COALESCE(u.tip, 0))
        FROM trips AS u
        WHERE u.status = 'done'
          AND u.driver = t.driver
          AND date(u.ended_at) = date(t.ended_at)
          AND (u.ended_at < t.ended_at
               OR (u.ended_at = t.ended_at AND u.trip_id <= t.trip_id))) AS day_total
FROM trips AS t
WHERE t.status = 'done'
ORDER BY t.driver, t.ended_at, t.trip_id;
