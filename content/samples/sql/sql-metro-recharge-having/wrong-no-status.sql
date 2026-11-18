SELECT card_no, COUNT(*) AS recharges, SUM(amount) AS total
FROM recharges
WHERE recharged_on BETWEEN '2026-10-01' AND '2026-10-31'
GROUP BY card_no
HAVING SUM(amount) >= {{min_total}}
ORDER BY total DESC, card_no;
