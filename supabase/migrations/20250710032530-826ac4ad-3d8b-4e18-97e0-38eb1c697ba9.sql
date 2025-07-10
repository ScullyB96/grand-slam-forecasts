-- Drop the existing league check constraint
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'teams_league_check') THEN
        ALTER TABLE public.teams DROP CONSTRAINT teams_league_check;
    END IF;
END $$;

-- Create a new, more flexible check constraint that allows all valid MLB league values
ALTER TABLE public.teams 
ADD CONSTRAINT teams_league_check 
CHECK (league IN (
    'AL', 'NL',  -- Standard abbreviations
    'American League', 'National League',  -- Full names
    'MLB'  -- Generic fallback
));