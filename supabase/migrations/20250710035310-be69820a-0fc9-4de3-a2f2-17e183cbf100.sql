-- Add last_updated column to game_predictions table for tracking when predictions were last generated
ALTER TABLE public.game_predictions 
ADD COLUMN last_updated TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create index for better performance on last_updated queries
CREATE INDEX IF NOT EXISTS idx_game_predictions_last_updated 
ON public.game_predictions(last_updated);

-- Update existing records to have last_updated = prediction_date if they don't have it
UPDATE public.game_predictions 
SET last_updated = prediction_date 
WHERE last_updated IS NULL;