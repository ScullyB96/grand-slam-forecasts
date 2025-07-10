-- Add unique constraint on game_id to enable upserts
ALTER TABLE game_predictions ADD CONSTRAINT game_predictions_game_id_unique UNIQUE (game_id);

-- Also add an index for better performance
CREATE INDEX IF NOT EXISTS idx_game_predictions_game_id ON game_predictions (game_id);