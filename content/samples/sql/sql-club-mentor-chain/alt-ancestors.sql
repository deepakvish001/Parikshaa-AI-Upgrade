WITH RECURSIVE
up(member_id, ancestor, steps) AS (
  SELECT member_id, mentor_id, 1
  FROM members
  WHERE mentor_id IS NOT NULL
  UNION ALL
  SELECT u.member_id, m.mentor_id, u.steps + 1
  FROM up AS u
  JOIN members AS m ON m.member_id = u.ancestor
  WHERE m.mentor_id IS NOT NULL
),
depths AS (
  SELECT member_id, MAX(steps) AS depth FROM up GROUP BY member_id
),
counts AS (
  SELECT ancestor, COUNT(*) AS juniors FROM up GROUP BY ancestor
)
SELECT m.member_id, m.name,
       COALESCE(d.depth, 0) AS depth,
       COALESCE(c.juniors, 0) AS juniors
FROM members AS m
LEFT JOIN depths AS d ON d.member_id = m.member_id
LEFT JOIN counts AS c ON c.ancestor = m.member_id
ORDER BY depth, m.member_id;
