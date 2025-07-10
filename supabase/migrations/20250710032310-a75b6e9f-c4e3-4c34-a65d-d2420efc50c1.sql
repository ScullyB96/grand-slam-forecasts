-- First, let's see what the current constraint looks like and drop it
DO $$ 
BEGIN
    -- Drop the existing check constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'teams_division_check') THEN
        ALTER TABLE public.teams DROP CONSTRAINT teams_division_check;
    END IF;
END $$;

-- Create a new, more flexible check constraint that allows all valid MLB divisions
ALTER TABLE public.teams 
ADD CONSTRAINT teams_division_check 
CHECK (division IN (
    'ALE', 'ALC', 'ALW',  -- American League
    'NLE', 'NLC', 'NLW',  -- National League
    'American League East', 'American League Central', 'American League West',
    'National League East', 'National League Central', 'National League West',
    'AL East', 'AL Central', 'AL West',
    'NL East', 'NL Central', 'NL West',
    'Unknown'  -- Fallback for any unmapped divisions
));