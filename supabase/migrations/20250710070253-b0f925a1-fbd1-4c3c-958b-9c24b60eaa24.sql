-- Create mock lineups for game 777166 (CHC @ MIN) that the user is viewing
-- First clear any existing data for this game
DELETE FROM game_lineups WHERE game_id = 777166;

-- Insert away team (CHC) batting lineup
INSERT INTO game_lineups (game_id, team_id, lineup_type, batting_order, player_id, player_name, position, handedness, is_starter) VALUES
(777166, 127, 'batting', 1, 1001, 'John Smith (CHC)', 'C', 'R', true),
(777166, 127, 'batting', 2, 1002, 'Mike Johnson (CHC)', '1B', 'L', true),
(777166, 127, 'batting', 3, 1003, 'David Wilson (CHC)', '2B', 'R', true),
(777166, 127, 'batting', 4, 1004, 'Chris Brown (CHC)', '3B', 'R', true),
(777166, 127, 'batting', 5, 1005, 'Matt Davis (CHC)', 'SS', 'L', true),
(777166, 127, 'batting', 6, 1006, 'Steve Miller (CHC)', 'LF', 'R', true),
(777166, 127, 'batting', 7, 1007, 'Tom Anderson (CHC)', 'CF', 'L', true),
(777166, 127, 'batting', 8, 1008, 'Jeff White (CHC)', 'RF', 'R', true),
(777166, 127, 'batting', 9, 1009, 'Ryan Taylor (CHC)', 'DH', 'L', true),
(777166, 127, 'pitching', null, 1010, 'Starting Pitcher (CHC)', 'SP', 'R', true);

-- Insert home team (MIN) batting lineup  
INSERT INTO game_lineups (game_id, team_id, lineup_type, batting_order, player_id, player_name, position, handedness, is_starter) VALUES
(777166, 126, 'batting', 1, 2001, 'John Smith (MIN)', 'C', 'L', true),
(777166, 126, 'batting', 2, 2002, 'Mike Johnson (MIN)', '1B', 'R', true),
(777166, 126, 'batting', 3, 2003, 'David Wilson (MIN)', '2B', 'L', true),
(777166, 126, 'batting', 4, 2004, 'Chris Brown (MIN)', '3B', 'R', true),
(777166, 126, 'batting', 5, 2005, 'Matt Davis (MIN)', 'SS', 'L', true),
(777166, 126, 'batting', 6, 2006, 'Steve Miller (MIN)', 'LF', 'R', true),
(777166, 126, 'batting', 7, 2007, 'Tom Anderson (MIN)', 'CF', 'L', true),
(777166, 126, 'batting', 8, 2008, 'Jeff White (MIN)', 'RF', 'R', true),
(777166, 126, 'batting', 9, 2009, 'Ryan Taylor (MIN)', 'DH', 'L', true),
(777166, 126, 'pitching', null, 2010, 'Starting Pitcher (MIN)', 'SP', 'L', true);