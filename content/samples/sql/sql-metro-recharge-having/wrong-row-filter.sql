SELECT card_no, COUNT(*) AS recharges, SUM(amount) AS total
FROM recharges
WHERE status = 'ok'
  AND recharged_on BETWEEN '2026-10-01' AND '2026-10-31'
  AND amount >= {{min_total}}
GROUP BY card_no
ORDER BY total DESC, card_no;
