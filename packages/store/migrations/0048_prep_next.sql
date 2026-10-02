-- Plan rows 42 to 49 (Prep tracker, 2 Oct 2026).
--
-- A learner takes down a solution they shared (row 44).
GRANT DELETE ON prep_code_shares TO parikshaa_app;

-- An erased account's study goes with it (row 47). Coins, credits, ratings,
-- days off and the rest are append-only for the app, and stay so: the app may
-- only call this, which deletes them for one learner, and only for a learner
-- whose account is already erased. Orders, invoices and credit notes stay, as
-- the law asks; a college's roster keeps the email it gave, unlinked.
CREATE FUNCTION prep_erase_study(p_org text, p_learner text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM learners WHERE org_id = p_org AND id = p_learner AND erased_at IS NOT NULL) THEN
    RAISE EXCEPTION 'prep_erase_study: % is not an erased learner', p_learner;
  END IF;
  DELETE FROM prep_sprint_quizzes WHERE org_id = p_org AND learner_id = p_learner;
  DELETE FROM prep_tasks WHERE org_id = p_org AND learner_id = p_learner;
  DELETE FROM prep_plans WHERE org_id = p_org AND learner_id = p_learner;
  DELETE FROM prep_cards WHERE org_id = p_org AND learner_id = p_learner;
  DELETE FROM prep_saved WHERE org_id = p_org AND learner_id = p_learner;
  DELETE FROM prep_focus WHERE org_id = p_org AND learner_id = p_learner;
  DELETE FROM prep_freezes WHERE org_id = p_org AND learner_id = p_learner;
  DELETE FROM prep_lessons_done WHERE org_id = p_org AND learner_id = p_learner;
  DELETE FROM prep_reminders_sent WHERE org_id = p_org AND learner_id = p_learner;
  DELETE FROM prep_coins WHERE org_id = p_org AND learner_id = p_learner;
  DELETE FROM prep_credits WHERE org_id = p_org AND learner_id = p_learner;
  DELETE FROM prep_ratings WHERE org_id = p_org AND learner_id = p_learner;
  DELETE FROM prep_code_shares WHERE org_id = p_org AND learner_id = p_learner;
  DELETE FROM prep_stories WHERE org_id = p_org AND learner_id = p_learner;
  DELETE FROM prep_experience_flags WHERE org_id = p_org AND learner_id = p_learner;
  UPDATE prep_cohort_members SET learner_id = NULL WHERE org_id = p_org AND learner_id = p_learner;
END $$;
REVOKE ALL ON FUNCTION prep_erase_study(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION prep_erase_study(text, text) TO parikshaa_app;
