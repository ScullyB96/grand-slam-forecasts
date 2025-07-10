
-- First, let's check what foreign key constraint exists and remove it
-- The game_lineups table should reference game_id directly from MLB API, not our internal games.id

-- Drop the existing foreign key constraint
ALTER TABLE game_lineups DROP CONSTRAINT IF EXISTS game_lineups_game_id_fkey;

-- We don't need a foreign key constraint here since game_id represents the MLB API game ID
-- which is different from our internal games table primary key
