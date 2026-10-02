-- The product is tech only (docs/LAUNCH-PLAN.md, 2 Oct 2026): handwritten
-- copy checking (0037, 0048's sealed pages) and course-outcome attainment
-- (0035) are gone, and their tables with them. Their history stays in git;
-- the migrations that made them stay too, since a database that ran them
-- records their names.
DROP TABLE IF EXISTS answer_script_pages;
DROP TABLE IF EXISTS answer_scripts;
DROP TABLE IF EXISTS exam_outcomes;
