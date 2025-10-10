-- Migration: Update edit limits and add daily reset for free users
-- Free users: 5 edits per day (resets daily)
-- Pro users: 200 edits per month (resets monthly)

-- Add daily_reset_date column for free users
ALTER TABLE public.user_usage 
ADD COLUMN IF NOT EXISTS daily_reset_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Update increment_edit_count function with new limits and daily resets
CREATE OR REPLACE FUNCTION public.increment_edit_count(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_edit_count INTEGER;
  current_monthly_count INTEGER;
  current_daily_reset DATE;
  user_monthly_reset DATE;
  is_pro_user BOOLEAN;
  max_free_daily_edits INTEGER := 100;
  max_pro_monthly_edits INTEGER := 200;
BEGIN
  -- Get current usage
  SELECT edit_count, monthly_edit_count, daily_reset_date, monthly_reset_date, is_pro 
  INTO current_edit_count, current_monthly_count, current_daily_reset, user_monthly_reset, is_pro_user
  FROM public.user_usage
  WHERE user_id = p_user_id;
  
  -- If user is pro, check monthly reset and limit
  IF is_pro_user THEN
    -- Check if monthly reset is needed
    IF CURRENT_DATE >= user_monthly_reset THEN
      UPDATE public.user_usage
      SET 
        monthly_edit_count = 0,
        monthly_reset_date = (CURRENT_DATE + INTERVAL '1 month')::date,
        updated_at = now()
      WHERE user_id = p_user_id;
      
      current_monthly_count := 0;
    END IF;
    
    -- Check monthly limit
    IF current_monthly_count >= max_pro_monthly_edits THEN
      RETURN FALSE; -- Monthly limit reached
    END IF;
    
    -- Increment monthly count
    UPDATE public.user_usage
    SET 
      monthly_edit_count = monthly_edit_count + 1,
      updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    -- Free user: check daily reset and limit
    -- Check if daily reset is needed
    IF CURRENT_DATE > current_daily_reset THEN
      UPDATE public.user_usage
      SET 
        edit_count = 0,
        daily_reset_date = CURRENT_DATE,
        updated_at = now()
      WHERE user_id = p_user_id;
      
      current_edit_count := 0;
    END IF;
    
    -- Check daily limit
    IF current_edit_count >= max_free_daily_edits THEN
      RETURN FALSE; -- Daily limit reached
    END IF;
    
    -- Increment daily count
    UPDATE public.user_usage
    SET 
      edit_count = edit_count + 1,
      updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

