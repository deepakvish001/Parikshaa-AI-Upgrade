WITH RECURSIVE
depth_of(member_id, depth) AS (
  SELECT member_id, 0 FROM members WHERE mentor_id IS NULL
  UNION ALL
  SELECT m.member_id, d.depth + 1 FROM members AS m JOIN depth_of AS d ON m.mentor_id = d.member_id
),
below(top_id, member_id) AS (
  SELECT member_id, member_id FROM members
  UNION ALL
  SELECT b.top_id, m.member_id FROM members AS m JOIN below AS b ON m.mentor_id = b.member_id
)
SELECT m.member_id, m.name, d.depth,
       (SELECT COUNT(*) FROM below AS b WHERE b.top_id = m.member_id) AS juniors
FROM members AS m
JOIN depth_of AS d ON d.member_id = m.member_id
ORDER BY d.depth, m.member_id;
