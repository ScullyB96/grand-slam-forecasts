# Statcast ETL Pipeline

This document outlines the complete Statcast data pipeline that powers our Monte Carlo simulation with real 2025 data.

## Overview

Our ETL pipeline eliminates generic defaults by ingesting real-time Statcast data from MLB's official APIs and Baseball Savant. The Monte Carlo simulation now uses:
- Player-specific exit velocities, barrel rates, and launch angles
- Pitcher-specific whiff rates, chase rates, and velocity data  
- Per-game pitch-by-pitch and hit-by-hit event logs
- Real 2025 season data with explicit queries

## Data Sources

### 1. MLB Stats API
- **Player Statcast Metrics**: `https://statsapi.mlb.com/api/v1/people/{playerId}/stats?stats=season&season=2025&group=statcast`
- **Live Game Feed**: `https://statsapi.mlb.com/api/v1/game/{gamePk}/feed/live`

### 2. Baseball Savant (Future Enhancement)
- **Nightly CSV Exports**: For comprehensive metrics not available via API

## Database Schema

### player_statcast
Aggregated per-player Statcast metrics for the season:
```sql
- player_id (int, primary key with season)
- season (int, default 2025)
- avg_exit_velocity, max_exit_velocity
- barrel_pct, hard_hit_pct, sweet_spot_pct
- xba, xslg, xwoba, xobp, xops (expected stats)
- avg_fastball_velocity, avg_spin_rate
- whiff_pct, chase_pct, extension
- outs_above_average (fielding)
```

### pitch_log  
Pitch-by-pitch event data:
```sql
- game_pk, inning, inning_half, pitch_number
- pitcher_id, batter_id
- start_speed, spin_rate, break_angle, zone
- coordinates (px, pz, x0, y0, z0, velocities, accelerations)
- pitch_type, description, result_type
```

### hit_log
Hit event data with Statcast metrics:
```sql
- game_pk, inning, inning_half, batter_id
- launch_speed, launch_angle, total_distance
- is_barrel, is_sweet_spot, is_hard_hit
- trajectory, hit_location, coordinates
```

## ETL Schedules

### Automated Jobs (via pg_cron)

1. **Nightly Statcast Ingestion** - 2 AM ET (7 AM UTC)
   - Triggers: `scheduled-statcast-ingestion` function
   - Updates all active player Statcast metrics
   - Processes recent game feeds
   - Refreshes predictions with new data

2. **Hourly Game Feed Ingestion** - Every hour
   - Triggers: `ingest-game-feed` function  
   - Processes live/recent games for pitch and hit data
   - Captures real-time Statcast events

### Manual Triggers

Available via Admin panel or direct API calls:
- `ingest-statcast-data` - Refresh player metrics
- `ingest-game-feed` - Process specific games
- `scheduled-statcast-ingestion` - Run full pipeline

## Edge Functions

### ingest-statcast-data
- Fetches 2025 Statcast data for active players
- Explicit season=2025 queries with group=["statcast"]
- Upserts comprehensive metrics into player_statcast table
- Processes in batches to handle API rate limits

### ingest-game-feed  
- Fetches live game feed data for specified games
- Extracts pitch-by-pitch and hit-by-hit Statcast data
- Populates pitch_log and hit_log tables
- Calculates derived metrics (is_barrel, is_hard_hit, etc.)

### scheduled-statcast-ingestion
- Orchestrates full pipeline execution
- Coordinates Statcast and game feed ingestion
- Refreshes predictions with updated data
- Provides comprehensive error handling and logging

## Monte Carlo Integration

The simulation now uses Statcast data for enhanced accuracy:

### Batting Simulation
- **Barrel Rate**: Real barrel percentage drives home run probability
- **Exit Velocity**: Average exit velocity affects hit quality
- **Launch Angle**: Influences trajectory and scoring likelihood  
- **xStats**: Expected batting average, OBP, SLG for projections
- **Hard Hit Rate**: Determines extra-base hit probability

### Pitching Effects
- **Whiff Rate**: Affects contact probability
- **Chase Rate**: Influences plate discipline outcomes
- **Velocity**: Higher velocity reduces barrel contact
- **Spin Rate**: Affects swing-and-miss rates

### Environmental Factors
- **Park Factors**: Applied to barrel rates and exit velocities
- **Weather**: Temperature and wind affect ball flight
- **Situational Context**: Inning, score, base runners

## Data Quality Monitoring

### Validation Checks
1. **Row Count Validation**: Compare expected vs actual records
2. **Missing Data Alerts**: Flag players without 2025 Statcast data  
3. **API Response Monitoring**: Track successful/failed ingestion attempts
4. **Confidence Scoring**: Adjust prediction confidence based on data completeness

### Quality Metrics
- Statcast data coverage percentage per team
- Pitch/hit event capture rate for recent games
- API response success rates
- Data freshness indicators

## Usage Examples

### Trigger Manual Ingestion
```typescript
// Refresh Statcast data for specific players
const { mutate: ingestStatcast } = useIngestStatcastData();
ingestStatcast({ playerIds: [123, 456], season: 2025 });

// Process specific game feeds  
const { mutate: ingestGameFeed } = useIngestGameFeed();
ingestGameFeed({ gameIds: [777156, 777157] });
```

### Query Statcast Data
```typescript
// Get player Statcast metrics
const { data: statcastData } = usePlayerStatcast(playerId, 2025);

// Get pitch log for game
const { data: pitchLog } = usePitchLog(gamePk);

// Get hit log for game  
const { data: hitLog } = useHitLog(gamePk);
```

## Performance Optimizations

1. **Indexed Queries**: Optimized indexes on player_id, game_pk, season
2. **Batch Processing**: Bulk inserts for pitch/hit data
3. **Upsert Strategy**: Efficient conflict resolution for player metrics
4. **Query Limits**: Reasonable limits to prevent large data transfers
5. **Caching Strategy**: React Query caching for frequently accessed data

## Monitoring & Alerts

- **Supabase Function Logs**: Real-time ingestion monitoring
- **Data Ingestion Jobs Table**: Historical job status and metrics
- **Error Tracking**: Comprehensive error logging and alerting
- **Performance Metrics**: Ingestion timing and throughput monitoring

## Future Enhancements

1. **Baseball Savant CSV Import**: Nightly bulk loads for comprehensive coverage
2. **Real-time Streaming**: WebSocket connections for live game events  
3. **Advanced Metrics**: Spin axis, release point, pitch tunneling data
4. **Machine Learning**: Predictive models for outcome probabilities
5. **Historical Backfill**: Multi-season Statcast data for trend analysis

## Troubleshooting

### Common Issues
1. **API Rate Limits**: Implemented batch processing and delays
2. **Missing Player Data**: Graceful fallbacks to positional estimates
3. **Game Feed Unavailable**: Retry logic with exponential backoff
4. **Data Type Mismatches**: Robust parsing with null handling

### Debug Commands
```sql
-- Check Statcast data coverage
SELECT COUNT(*) as players_with_statcast FROM player_statcast WHERE season = 2025;

-- Monitor recent ingestion jobs
SELECT * FROM data_ingestion_jobs WHERE job_type = 'statcast' ORDER BY created_at DESC LIMIT 10;

-- Validate pitch/hit data for game
SELECT COUNT(*) as pitch_count FROM pitch_log WHERE game_pk = 777156;
SELECT COUNT(*) as hit_count FROM hit_log WHERE game_pk = 777156;
```

This pipeline ensures our Monte Carlo simulation runs on authentic 2025 Statcast data, eliminating generic defaults and providing accurate, data-driven predictions.