-- Add onboarding tracking fields to user_usage

alter table user_usage
  add column if not exists referral_source text,
  add column if not exists onboarding_completed boolean default false;

create index if not exists user_usage_onboarding_completed_idx
  on user_usage (onboarding_completed);

