SELECT card_no, recharges, total
FROM (
  SELECT card_no, COUNT(*) AS recharges, SUM(amount) AS total
  FROM recharges
  WHERE status = 'ok'
    AND strftime('%Y-%m', recharged_on) = '2026-10'
  GROUP BY card_no
) AS per_card
WHERE total >= {{min_total}}
ORDER BY total DESC, card_no;
