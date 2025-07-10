-- Clear all fake/mock lineup data
DELETE FROM game_lineups WHERE 
  player_name LIKE '%John Smith%' OR 
  player_name LIKE '%Mike Johnson%' OR 
  player_name LIKE '%David Wilson%' OR
  player_name LIKE '%Chris Brown%' OR
  player_name LIKE '%Matt Davis%' OR
  player_name LIKE '%Steve Miller%' OR
  player_name LIKE '%Tom Anderson%' OR
  player_name LIKE '%Jeff White%' OR
  player_name LIKE '%Ryan Taylor%' OR
  player_name LIKE '%Kevin Moore%' OR
  player_name LIKE 'Starting Pitcher%' OR
  player_name LIKE '%Tiers Early%';