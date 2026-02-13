-- Allow multiple weekly check-ins per user/week
-- Drops the unique index that enforced one check-in per week

DROP INDEX IF EXISTS weekly_checkin_unique_idx;
