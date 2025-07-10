
# MLB Lineup Pipeline - Bulletproof Implementation

## Overview

This document describes the robust, bulletproof MLB lineup ingestion pipeline that ensures reliable daily lineup data collection and validation.

## Architecture

### 1. Scheduled Ingestion (`lineup-scheduler`)
- **Schedule**: Daily at 4 AM ET (8 AM UTC)
- **Backup Validation**: 4:30 AM ET (8:30 AM UTC)
- **Cron Expression**: `0 8 * * *` (handles daylight saving automatically)

### 2. Robust Ingestion Function (`ingest-lineups`)
- **Retry Logic**: 3 attempts with 5-minute backoff for failed requests
- **Defensive Validation**: Checks completion rates and data integrity
- **Error Handling**: Comprehensive logging and alerting
- **Conflict Resolution**: Upsert with `onConflict` handling

### 3. Front-end Validation (`useGameLineupsRobust`)
- **Auto-Retry**: 5 attempts with 30-second intervals
- **Real-time Validation**: Checks lineup completeness
- **User Feedback**: Clear status indicators and error messages

## Data Validation Metrics

### Expected Data Points
- **Per Game**: 2 teams × 9 batters + 2 starting pitchers = ~20 lineup entries
- **Per Day**: Varies by schedule (typically 10-15 games = 200-300 entries)

### Completion Thresholds
- **Complete Lineup**: ≥8 batters + ≥1 pitcher per team
- **Alert Threshold**: <80% completion rate
- **Retry Threshold**: Any incomplete lineups

### Validation Checks
1. **Schedule Validation**: Non-empty games array from MLB API
2. **Boxscore Availability**: Valid teams object in response
3. **Row Count Matching**: Inserted rows = expected players
4. **Completion Rate**: Actual vs expected lineup entries
5. **Team Mapping**: Valid MLB team ID to database ID mapping

## Error Handling & Logging

### Error Categories
1. **Schedule Fetch Errors**: MLB API unavailable or empty response
2. **Boxscore 404 Errors**: Game data not yet available (handled with retry)
3. **Upsert Failures**: Database constraint or connection issues
4. **Validation Failures**: Incomplete or malformed lineup data

### Logging Locations
- **Ingestion Jobs Table**: `lineup_ingestion_jobs`
  - Status, retry count, error details
  - Games expected vs processed
  - Completion timestamps
- **Console Logs**: Real-time processing information
- **Function Logs**: Available in Supabase dashboard

### Debug Metrics
- `games_expected`: Total games for the date
- `games_processed`: Successfully processed games  
- `games_failed`: Games that failed after all retries
- `error_details`: Specific error messages and alerts
- `completion_rate`: Percentage of expected lineup entries collected

## Frontend Error Handling

### Status Indicators
- **🟢 Complete**: All lineups confirmed with full rosters
- **🟡 Loading**: Partial data available, checking for updates
- **🟠 Partial**: Some players missing, max retries not reached
- **🔴 Incomplete**: Missing data after all retry attempts
- **⚫ Unavailable**: No lineup data available

### Retry Behavior
- **Automatic**: 5 retries with 30-second intervals
- **Manual**: User can trigger manual refresh
- **Progressive**: Shows retry count and next attempt time

## Monitoring & Alerts

### Automated Alerts
- **Low Completion Rate**: <80% of expected lineup entries
- **Failed Games**: Games that couldn't be processed after 3 attempts
- **Empty Schedule**: No games found for expected game day
- **Upsert Mismatches**: Row count doesn't match expected players

### Manual Monitoring
1. Check `lineup_ingestion_jobs` table for daily status
2. Monitor completion rates in job records
3. Review error details for failed processing
4. Validate lineup counts in `game_lineups` table

## API Endpoints Used

### MLB Stats API
- **Schedule**: `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date={YYYY-MM-DD}&hydrate=team,linescore`
- **Boxscore**: `https://statsapi.mlb.com/api/v1/game/{gamePk}/boxscore`

### Response Validation
- Schedule must have `dates[0].games` array
- Boxscore must have `teams.home` and `teams.away` objects
- Player data must include `person.id`, `person.fullName`
- Position data should include `position.abbreviation`

## Database Schema

### Primary Tables
- `game_lineups`: Individual player lineup entries
- `lineup_ingestion_jobs`: Job status and metrics tracking
- `teams`: Team mapping (MLB ID to internal ID)

### Key Relationships
- `game_lineups.game_id` → `games.game_id`
- `game_lineups.team_id` → `teams.id`
- `teams.team_id` → MLB team ID

## Troubleshooting

### Common Issues
1. **Empty Lineups**: Check if games have started (lineups released 1-2 hours before)
2. **404 Errors**: Normal for games far in advance, handled by retry logic
3. **Partial Data**: Some players may be late additions, system will retry
4. **Team Mapping**: Ensure all MLB teams are in the teams table

### Manual Recovery
1. Run ingestion with `force: true` to refresh existing data
2. Check specific game with boxscore API directly
3. Validate team mappings in teams table
4. Review job logs for specific error patterns

### Testing
- Add `?test=true` to scheduler endpoint to run immediate test
- Use `force: true` in ingestion request to override existing data
- Monitor real-time logs during processing

## Performance Considerations

### Rate Limiting
- 5-minute delays between retries prevent API rate limiting
- Sequential processing prevents overwhelming MLB API
- Reasonable timeout values for network requests

### Database Optimization
- Upsert operations minimize duplicate data
- Indexed queries on game_id and team_id
- Batch operations for efficiency

### Memory Management
- Process games individually to limit memory usage
- Clear temporary data between game processing
- Efficient data transformation and validation

This bulletproof implementation ensures reliable lineup data collection with comprehensive error handling, validation, and recovery mechanisms.
