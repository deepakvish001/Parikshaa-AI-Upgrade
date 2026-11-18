SELECT t.driver,
       t.trip_id,
       t.ended_at,
       t.fare + COALESCE(t.tip, 0) AS earning,
       SUM(u.fare + COALESCE(u.tip, 0)) AS day_total
FROM trips AS t
JOIN trips AS u
  ON u.driver = t.driver
 AND u.status = 'done'
 AND date(u.ended_at) = date(t.ended_at)
 AND (u.ended_at < t.ended_at OR (u.ended_at = t.ended_at AND u.trip_id <= t.trip_id))
WHERE t.status = 'done'
GROUP BY t.trip_id, t.driver, t.ended_at, t.fare, t.tip
ORDER BY t.driver, t.ended_at, t.trip_id;
