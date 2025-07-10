-- Insert test game for Mets vs Orioles if it doesn't exist
INSERT INTO games (game_id, game_date, home_team_id, away_team_id, status, venue_name, game_time)
VALUES (777165, '2025-07-10', 110, 121, 'scheduled', 'Oriole Park at Camden Yards', '12:05:00')
ON CONFLICT (game_id) DO NOTHING;