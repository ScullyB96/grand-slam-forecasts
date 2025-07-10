-- Create mock lineups for game 777166 (CHC @ MIN) that the user is viewing
-- First clear any existing data for this game
DELETE FROM game_lineups WHERE game_id = 777166;

-- Insert away team (CHC) batting lineup
INSERT INTO game_lineups (game_id, team_id, lineup_type, batting_order, player_id, player_name, position, handedness, is_starter) VALUES
(777166, 127, 'batting', 1, 0, 'John Smith (CHC)', 'C', 'R', true),
(777166, 127, 'batting', 2, 0, 'Mike Johnson (CHC)', '1B', 'L', true),
(777166, 127, 'batting', 3, 0, 'David Wilson (CHC)', '2B', 'R', true),
(777166, 127, 'batting', 4, 0, 'Chris Brown (CHC)', '3B', 'R', true),
(777166, 127, 'batting', 5, 0, 'Matt Davis (CHC)', 'SS', 'L', true),
(777166, 127, 'batting', 6, 0, 'Steve Miller (CHC)', 'LF', 'R', true),
(777166, 127, 'batting', 7, 0, 'Tom Anderson (CHC)', 'CF', 'L', true),
(777166, 127, 'batting', 8, 0, 'Jeff White (CHC)', 'RF', 'R', true),
(777166, 127, 'batting', 9, 0, 'Ryan Taylor (CHC)', 'DH', 'L', true);

-- Insert away team (CHC) starting pitcher
INSERT INTO game_lineups (game_id, team_id, lineup_type, batting_order, player_id, player_name, position, handedness, is_starter) VALUES
(777166, 127, 'pitching', null, 0, 'Starting Pitcher (CHC)', 'SP', 'R', true);

-- Insert home team (MIN) batting lineup  
INSERT INTO game_lineups (game_id, team_id, lineup_type, batting_order, player_id, player_name, position, handedness, is_starter) VALUES
(777166, 126, 'batting', 1, 0, 'John Smith (MIN)', 'C', 'L', true),
(777166, 126, 'batting', 2, 0, 'Mike Johnson (MIN)', '1B', 'R', true),
(777166, 126, 'batting', 3, 0, 'David Wilson (MIN)', '2B', 'L', true),
(777166, 126, 'batting', 4, 0, 'Chris Brown (MIN)', '3B', 'R', true),
(777166, 126, 'batting', 5, 0, 'Matt Davis (MIN)', 'SS', 'L', true),
(777166, 126, 'batting', 6, 0, 'Steve Miller (MIN)', 'LF', 'R', true),
(777166, 126, 'batting', 7, 0, 'Tom Anderson (MIN)', 'CF', 'L', true),
(777166, 126, 'batting', 8, 0, 'Jeff White (MIN)', 'RF', 'R', true),
(777166, 126, 'batting', 9, 0, 'Ryan Taylor (MIN)', 'DH', 'L', true);

-- Insert home team (MIN) starting pitcher
INSERT INTO game_lineups (game_id, team_id, lineup_type, batting_order, player_id, player_name, position, handedness, is_starter) VALUES
(777166, 126, 'pitching', null, 0, 'Starting Pitcher (MIN)', 'SP', 'L', true);