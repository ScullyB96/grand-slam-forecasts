export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      batting_splits: {
        Row: {
          at_bats: number | null
          avg: number | null
          created_at: string | null
          doubles: number | null
          games_played: number | null
          hits: number | null
          home_runs: number | null
          id: number
          obp: number | null
          ops: number | null
          player_id: number
          rbi: number | null
          runs: number | null
          season: number
          slg: number | null
          strikeouts: number | null
          team_id: number | null
          triples: number | null
          updated_at: string | null
          vs_handedness: string
          walks: number | null
          wrc_plus: number | null
        }
        Insert: {
          at_bats?: number | null
          avg?: number | null
          created_at?: string | null
          doubles?: number | null
          games_played?: number | null
          hits?: number | null
          home_runs?: number | null
          id?: number
          obp?: number | null
          ops?: number | null
          player_id: number
          rbi?: number | null
          runs?: number | null
          season: number
          slg?: number | null
          strikeouts?: number | null
          team_id?: number | null
          triples?: number | null
          updated_at?: string | null
          vs_handedness: string
          walks?: number | null
          wrc_plus?: number | null
        }
        Update: {
          at_bats?: number | null
          avg?: number | null
          created_at?: string | null
          doubles?: number | null
          games_played?: number | null
          hits?: number | null
          home_runs?: number | null
          id?: number
          obp?: number | null
          ops?: number | null
          player_id?: number
          rbi?: number | null
          runs?: number | null
          season?: number
          slg?: number | null
          strikeouts?: number | null
          team_id?: number | null
          triples?: number | null
          updated_at?: string | null
          vs_handedness?: string
          walks?: number | null
          wrc_plus?: number | null
        }
        Relationships: []
      }
      batting_stats: {
        Row: {
          at_bats: number | null
          avg: number | null
          babip: number | null
          caught_stealing: number | null
          created_at: string | null
          doubles: number | null
          games_played: number | null
          hit_by_pitch: number | null
          hits: number | null
          home_runs: number | null
          id: number
          iso: number | null
          obp: number | null
          ops: number | null
          player_id: number
          rbi: number | null
          runs: number | null
          sacrifice_flies: number | null
          sacrifice_hits: number | null
          season: number
          slg: number | null
          stolen_bases: number | null
          strikeouts: number | null
          team_id: number | null
          triples: number | null
          updated_at: string | null
          walks: number | null
          wrc_plus: number | null
        }
        Insert: {
          at_bats?: number | null
          avg?: number | null
          babip?: number | null
          caught_stealing?: number | null
          created_at?: string | null
          doubles?: number | null
          games_played?: number | null
          hit_by_pitch?: number | null
          hits?: number | null
          home_runs?: number | null
          id?: number
          iso?: number | null
          obp?: number | null
          ops?: number | null
          player_id: number
          rbi?: number | null
          runs?: number | null
          sacrifice_flies?: number | null
          sacrifice_hits?: number | null
          season: number
          slg?: number | null
          stolen_bases?: number | null
          strikeouts?: number | null
          team_id?: number | null
          triples?: number | null
          updated_at?: string | null
          walks?: number | null
          wrc_plus?: number | null
        }
        Update: {
          at_bats?: number | null
          avg?: number | null
          babip?: number | null
          caught_stealing?: number | null
          created_at?: string | null
          doubles?: number | null
          games_played?: number | null
          hit_by_pitch?: number | null
          hits?: number | null
          home_runs?: number | null
          id?: number
          iso?: number | null
          obp?: number | null
          ops?: number | null
          player_id?: number
          rbi?: number | null
          runs?: number | null
          sacrifice_flies?: number | null
          sacrifice_hits?: number | null
          season?: number
          slg?: number | null
          stolen_bases?: number | null
          strikeouts?: number | null
          team_id?: number | null
          triples?: number | null
          updated_at?: string | null
          walks?: number | null
          wrc_plus?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batting_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "batting_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bullpen_stats: {
        Row: {
          avg_leverage_index: number | null
          bb_9: number | null
          blown_saves: number | null
          created_at: string | null
          era: number | null
          holds: number | null
          hr_9: number | null
          id: number
          k_9: number | null
          save_opportunities: number | null
          save_percentage: number | null
          saves: number | null
          season: number
          team_id: number
          updated_at: string | null
          whip: number | null
          win_probability_added: number | null
        }
        Insert: {
          avg_leverage_index?: number | null
          bb_9?: number | null
          blown_saves?: number | null
          created_at?: string | null
          era?: number | null
          holds?: number | null
          hr_9?: number | null
          id?: number
          k_9?: number | null
          save_opportunities?: number | null
          save_percentage?: number | null
          saves?: number | null
          season: number
          team_id: number
          updated_at?: string | null
          whip?: number | null
          win_probability_added?: number | null
        }
        Update: {
          avg_leverage_index?: number | null
          bb_9?: number | null
          blown_saves?: number | null
          created_at?: string | null
          era?: number | null
          holds?: number | null
          hr_9?: number | null
          id?: number
          k_9?: number | null
          save_opportunities?: number | null
          save_percentage?: number | null
          saves?: number | null
          season?: number
          team_id?: number
          updated_at?: string | null
          whip?: number | null
          win_probability_added?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bullpen_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      data_audit_results: {
        Row: {
          anomalies: Json | null
          audit_date: string
          audit_type: string
          completeness_score: number | null
          created_at: string | null
          data_source: string
          error_details: string | null
          id: number
          metrics: Json | null
          status: string
        }
        Insert: {
          anomalies?: Json | null
          audit_date?: string
          audit_type: string
          completeness_score?: number | null
          created_at?: string | null
          data_source: string
          error_details?: string | null
          id?: number
          metrics?: Json | null
          status: string
        }
        Update: {
          anomalies?: Json | null
          audit_date?: string
          audit_type?: string
          completeness_score?: number | null
          created_at?: string | null
          data_source?: string
          error_details?: string | null
          id?: number
          metrics?: Json | null
          status?: string
        }
        Relationships: []
      }
      data_ingestion_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          data_source: string | null
          error_details: Json | null
          errors_count: number | null
          id: number
          job_name: string
          job_type: string
          max_retries: number | null
          next_retry_at: string | null
          records_inserted: number | null
          records_processed: number | null
          records_updated: number | null
          retry_count: number | null
          season: number | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          data_source?: string | null
          error_details?: Json | null
          errors_count?: number | null
          id?: number
          job_name: string
          job_type: string
          max_retries?: number | null
          next_retry_at?: string | null
          records_inserted?: number | null
          records_processed?: number | null
          records_updated?: number | null
          retry_count?: number | null
          season?: number | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          data_source?: string | null
          error_details?: Json | null
          errors_count?: number | null
          id?: number
          job_name?: string
          job_type?: string
          max_retries?: number | null
          next_retry_at?: string | null
          records_inserted?: number | null
          records_processed?: number | null
          records_updated?: number | null
          retry_count?: number | null
          season?: number | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      feature_engineering_cache: {
        Row: {
          created_at: string | null
          feature_version: string
          features: Json
          game_date: string
          id: number
          team_id: number
        }
        Insert: {
          created_at?: string | null
          feature_version: string
          features: Json
          game_date: string
          id?: number
          team_id: number
        }
        Update: {
          created_at?: string | null
          feature_version?: string
          features?: Json
          game_date?: string
          id?: number
          team_id?: number
        }
        Relationships: []
      }
      game_lineups: {
        Row: {
          batting_order: number | null
          created_at: string | null
          game_id: number
          handedness: string | null
          id: string
          is_starter: boolean | null
          lineup_type: string
          player_id: number
          player_name: string
          position: string | null
          team_id: number
          updated_at: string | null
        }
        Insert: {
          batting_order?: number | null
          created_at?: string | null
          game_id: number
          handedness?: string | null
          id?: string
          is_starter?: boolean | null
          lineup_type: string
          player_id: number
          player_name: string
          position?: string | null
          team_id: number
          updated_at?: string | null
        }
        Update: {
          batting_order?: number | null
          created_at?: string | null
          game_id?: number
          handedness?: string | null
          id?: string
          is_starter?: boolean | null
          lineup_type?: string
          player_id?: number
          player_name?: string
          position?: string | null
          team_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_lineups_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "game_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      game_predictions: {
        Row: {
          away_win_probability: number
          confidence_score: number | null
          created_at: string | null
          game_id: number
          home_win_probability: number
          id: number
          key_factors: Json | null
          last_updated: string | null
          over_probability: number | null
          over_under_line: number | null
          predicted_away_score: number | null
          predicted_home_score: number | null
          prediction_date: string | null
          under_probability: number | null
          updated_at: string | null
        }
        Insert: {
          away_win_probability: number
          confidence_score?: number | null
          created_at?: string | null
          game_id: number
          home_win_probability: number
          id?: number
          key_factors?: Json | null
          last_updated?: string | null
          over_probability?: number | null
          over_under_line?: number | null
          predicted_away_score?: number | null
          predicted_home_score?: number | null
          prediction_date?: string | null
          under_probability?: number | null
          updated_at?: string | null
        }
        Update: {
          away_win_probability?: number
          confidence_score?: number | null
          created_at?: string | null
          game_id?: number
          home_win_probability?: number
          id?: number
          key_factors?: Json | null
          last_updated?: string | null
          over_probability?: number | null
          over_under_line?: number | null
          predicted_away_score?: number | null
          predicted_home_score?: number | null
          prediction_date?: string | null
          under_probability?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_predictions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["game_id"]
          },
        ]
      }
      games: {
        Row: {
          away_score: number | null
          away_team_id: number
          created_at: string | null
          game_date: string
          game_id: number
          game_time: string | null
          home_score: number | null
          home_team_id: number
          id: number
          status: string
          updated_at: string | null
          venue_name: string | null
        }
        Insert: {
          away_score?: number | null
          away_team_id: number
          created_at?: string | null
          game_date: string
          game_id: number
          game_time?: string | null
          home_score?: number | null
          home_team_id: number
          id?: number
          status?: string
          updated_at?: string | null
          venue_name?: string | null
        }
        Update: {
          away_score?: number | null
          away_team_id?: number
          created_at?: string | null
          game_date?: string
          game_id?: number
          game_time?: string | null
          home_score?: number | null
          home_team_id?: number
          id?: number
          status?: string
          updated_at?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      lineup_ingestion_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_details: string | null
          failed_games: Json | null
          games_expected: number | null
          games_failed: number | null
          games_processed: number | null
          id: string
          job_date: string
          next_retry_at: string | null
          retry_count: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_details?: string | null
          failed_games?: Json | null
          games_expected?: number | null
          games_failed?: number | null
          games_processed?: number | null
          id?: string
          job_date: string
          next_retry_at?: string | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_details?: string | null
          failed_games?: Json | null
          games_expected?: number | null
          games_failed?: number | null
          games_processed?: number | null
          id?: string
          job_date?: string
          next_retry_at?: string | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      lineups: {
        Row: {
          batting_order: number | null
          created_at: string
          date: string
          game_pk: number
          id: string
          player_id: number
          player_name: string | null
          position_code: string | null
          team_id: number
          updated_at: string
        }
        Insert: {
          batting_order?: number | null
          created_at?: string
          date?: string
          game_pk: number
          id?: string
          player_id: number
          player_name?: string | null
          position_code?: string | null
          team_id: number
          updated_at?: string
        }
        Update: {
          batting_order?: number | null
          created_at?: string
          date?: string
          game_pk?: number
          id?: string
          player_id?: number
          player_name?: string | null
          position_code?: string | null
          team_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      ml_model_metadata: {
        Row: {
          created_at: string | null
          feature_importance: Json | null
          hyperparameters: Json | null
          id: number
          is_active: boolean | null
          model_name: string
          model_type: string
          model_version: string
          training_date: string
          training_metrics: Json | null
          validation_metrics: Json | null
        }
        Insert: {
          created_at?: string | null
          feature_importance?: Json | null
          hyperparameters?: Json | null
          id?: number
          is_active?: boolean | null
          model_name: string
          model_type: string
          model_version: string
          training_date: string
          training_metrics?: Json | null
          validation_metrics?: Json | null
        }
        Update: {
          created_at?: string | null
          feature_importance?: Json | null
          hyperparameters?: Json | null
          id?: number
          is_active?: boolean | null
          model_name?: string
          model_type?: string
          model_version?: string
          training_date?: string
          training_metrics?: Json | null
          validation_metrics?: Json | null
        }
        Relationships: []
      }
      park_factors: {
        Row: {
          altitude: number | null
          center_field_distance: number | null
          center_field_height: number | null
          created_at: string | null
          foul_territory_rating: number | null
          hits_factor: number | null
          hr_factor: number | null
          id: number
          left_field_distance: number | null
          left_field_height: number | null
          right_field_distance: number | null
          right_field_height: number | null
          runs_factor: number | null
          season: number
          strikeouts_factor: number | null
          surface: string | null
          updated_at: string | null
          venue_name: string
          walks_factor: number | null
        }
        Insert: {
          altitude?: number | null
          center_field_distance?: number | null
          center_field_height?: number | null
          created_at?: string | null
          foul_territory_rating?: number | null
          hits_factor?: number | null
          hr_factor?: number | null
          id?: number
          left_field_distance?: number | null
          left_field_height?: number | null
          right_field_distance?: number | null
          right_field_height?: number | null
          runs_factor?: number | null
          season: number
          strikeouts_factor?: number | null
          surface?: string | null
          updated_at?: string | null
          venue_name: string
          walks_factor?: number | null
        }
        Update: {
          altitude?: number | null
          center_field_distance?: number | null
          center_field_height?: number | null
          created_at?: string | null
          foul_territory_rating?: number | null
          hits_factor?: number | null
          hr_factor?: number | null
          id?: number
          left_field_distance?: number | null
          left_field_height?: number | null
          right_field_distance?: number | null
          right_field_height?: number | null
          runs_factor?: number | null
          season?: number
          strikeouts_factor?: number | null
          surface?: string | null
          updated_at?: string | null
          venue_name?: string
          walks_factor?: number | null
        }
        Relationships: []
      }
      pitching_splits: {
        Row: {
          bb_9: number | null
          created_at: string | null
          earned_runs: number | null
          era: number | null
          games: number | null
          games_started: number | null
          hits_allowed: number | null
          home_runs_allowed: number | null
          hr_9: number | null
          id: number
          innings_pitched: number | null
          k_9: number | null
          player_id: number
          runs_allowed: number | null
          season: number
          split_type: string
          strikeouts: number | null
          team_id: number | null
          updated_at: string | null
          walks: number | null
          whip: number | null
        }
        Insert: {
          bb_9?: number | null
          created_at?: string | null
          earned_runs?: number | null
          era?: number | null
          games?: number | null
          games_started?: number | null
          hits_allowed?: number | null
          home_runs_allowed?: number | null
          hr_9?: number | null
          id?: number
          innings_pitched?: number | null
          k_9?: number | null
          player_id: number
          runs_allowed?: number | null
          season: number
          split_type: string
          strikeouts?: number | null
          team_id?: number | null
          updated_at?: string | null
          walks?: number | null
          whip?: number | null
        }
        Update: {
          bb_9?: number | null
          created_at?: string | null
          earned_runs?: number | null
          era?: number | null
          games?: number | null
          games_started?: number | null
          hits_allowed?: number | null
          home_runs_allowed?: number | null
          hr_9?: number | null
          id?: number
          innings_pitched?: number | null
          k_9?: number | null
          player_id?: number
          runs_allowed?: number | null
          season?: number
          split_type?: string
          strikeouts?: number | null
          team_id?: number | null
          updated_at?: string | null
          walks?: number | null
          whip?: number | null
        }
        Relationships: []
      }
      pitching_stats: {
        Row: {
          babip: number | null
          bb_9: number | null
          blown_saves: number | null
          complete_games: number | null
          created_at: string | null
          earned_runs: number | null
          era: number | null
          fip: number | null
          games: number | null
          games_started: number | null
          hit_batters: number | null
          hits_allowed: number | null
          holds: number | null
          home_runs_allowed: number | null
          hr_9: number | null
          id: number
          innings_pitched: number | null
          intentional_walks: number | null
          k_9: number | null
          player_id: number
          runs_allowed: number | null
          save_opportunities: number | null
          saves: number | null
          season: number
          shutouts: number | null
          strand_rate: number | null
          strikeouts: number | null
          team_id: number | null
          updated_at: string | null
          walks: number | null
          whip: number | null
          wild_pitches: number | null
          xfip: number | null
        }
        Insert: {
          babip?: number | null
          bb_9?: number | null
          blown_saves?: number | null
          complete_games?: number | null
          created_at?: string | null
          earned_runs?: number | null
          era?: number | null
          fip?: number | null
          games?: number | null
          games_started?: number | null
          hit_batters?: number | null
          hits_allowed?: number | null
          holds?: number | null
          home_runs_allowed?: number | null
          hr_9?: number | null
          id?: number
          innings_pitched?: number | null
          intentional_walks?: number | null
          k_9?: number | null
          player_id: number
          runs_allowed?: number | null
          save_opportunities?: number | null
          saves?: number | null
          season: number
          shutouts?: number | null
          strand_rate?: number | null
          strikeouts?: number | null
          team_id?: number | null
          updated_at?: string | null
          walks?: number | null
          whip?: number | null
          wild_pitches?: number | null
          xfip?: number | null
        }
        Update: {
          babip?: number | null
          bb_9?: number | null
          blown_saves?: number | null
          complete_games?: number | null
          created_at?: string | null
          earned_runs?: number | null
          era?: number | null
          fip?: number | null
          games?: number | null
          games_started?: number | null
          hit_batters?: number | null
          hits_allowed?: number | null
          holds?: number | null
          home_runs_allowed?: number | null
          hr_9?: number | null
          id?: number
          innings_pitched?: number | null
          intentional_walks?: number | null
          k_9?: number | null
          player_id?: number
          runs_allowed?: number | null
          save_opportunities?: number | null
          saves?: number | null
          season?: number
          shutouts?: number | null
          strand_rate?: number | null
          strikeouts?: number | null
          team_id?: number | null
          updated_at?: string | null
          walks?: number | null
          whip?: number | null
          wild_pitches?: number | null
          xfip?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pitching_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "pitching_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          active: boolean | null
          batting_hand: string | null
          birth_date: string | null
          created_at: string | null
          first_name: string | null
          full_name: string
          height_inches: number | null
          id: number
          jersey_number: number | null
          last_name: string | null
          pitching_hand: string | null
          player_id: number
          position: string | null
          team_id: number | null
          updated_at: string | null
          weight_pounds: number | null
        }
        Insert: {
          active?: boolean | null
          batting_hand?: string | null
          birth_date?: string | null
          created_at?: string | null
          first_name?: string | null
          full_name: string
          height_inches?: number | null
          id?: number
          jersey_number?: number | null
          last_name?: string | null
          pitching_hand?: string | null
          player_id: number
          position?: string | null
          team_id?: number | null
          updated_at?: string | null
          weight_pounds?: number | null
        }
        Update: {
          active?: boolean | null
          batting_hand?: string | null
          birth_date?: string | null
          created_at?: string | null
          first_name?: string | null
          full_name?: string
          height_inches?: number | null
          id?: number
          jersey_number?: number | null
          last_name?: string | null
          pitching_hand?: string | null
          player_id?: number
          position?: string | null
          team_id?: number | null
          updated_at?: string | null
          weight_pounds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_performance: {
        Row: {
          actual_away_score: number | null
          actual_home_score: number | null
          actual_winner: string | null
          confidence_score: number | null
          created_at: string | null
          game_date: string
          game_id: number | null
          id: number
          model_id: number | null
          predicted_away_score: number | null
          predicted_away_win_prob: number | null
          predicted_home_score: number | null
          predicted_home_win_prob: number | null
          prediction_accuracy: number | null
          prediction_date: string
          score_mae: number | null
        }
        Insert: {
          actual_away_score?: number | null
          actual_home_score?: number | null
          actual_winner?: string | null
          confidence_score?: number | null
          created_at?: string | null
          game_date: string
          game_id?: number | null
          id?: number
          model_id?: number | null
          predicted_away_score?: number | null
          predicted_away_win_prob?: number | null
          predicted_home_score?: number | null
          predicted_home_win_prob?: number | null
          prediction_accuracy?: number | null
          prediction_date: string
          score_mae?: number | null
        }
        Update: {
          actual_away_score?: number | null
          actual_home_score?: number | null
          actual_winner?: string | null
          confidence_score?: number | null
          created_at?: string | null
          game_date?: string
          game_id?: number | null
          id?: number
          model_id?: number | null
          predicted_away_score?: number | null
          predicted_away_win_prob?: number | null
          predicted_home_score?: number | null
          predicted_home_win_prob?: number | null
          prediction_accuracy?: number | null
          prediction_date?: string
          score_mae?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prediction_performance_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "prediction_performance_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ml_model_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      team_stats: {
        Row: {
          created_at: string | null
          id: number
          losses: number
          runs_allowed: number
          runs_scored: number
          season: number
          team_avg: number
          team_era: number
          team_id: number
          team_obp: number
          team_slg: number
          updated_at: string | null
          wins: number
        }
        Insert: {
          created_at?: string | null
          id?: number
          losses?: number
          runs_allowed?: number
          runs_scored?: number
          season: number
          team_avg?: number
          team_era?: number
          team_id: number
          team_obp?: number
          team_slg?: number
          updated_at?: string | null
          wins?: number
        }
        Update: {
          created_at?: string | null
          id?: number
          losses?: number
          runs_allowed?: number
          runs_scored?: number
          season?: number
          team_avg?: number
          team_era?: number
          team_id?: number
          team_obp?: number
          team_slg?: number
          updated_at?: string | null
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_trends: {
        Row: {
          away_losses: number | null
          away_wins: number | null
          created_at: string | null
          day_game_losses: number | null
          day_game_wins: number | null
          home_losses: number | null
          home_wins: number | null
          id: number
          last_10_losses: number | null
          last_10_wins: number | null
          last_30_losses: number | null
          last_30_wins: number | null
          night_game_losses: number | null
          night_game_wins: number | null
          season: number
          team_id: number
          updated_at: string | null
          vs_left_losses: number | null
          vs_left_wins: number | null
          vs_right_losses: number | null
          vs_right_wins: number | null
        }
        Insert: {
          away_losses?: number | null
          away_wins?: number | null
          created_at?: string | null
          day_game_losses?: number | null
          day_game_wins?: number | null
          home_losses?: number | null
          home_wins?: number | null
          id?: number
          last_10_losses?: number | null
          last_10_wins?: number | null
          last_30_losses?: number | null
          last_30_wins?: number | null
          night_game_losses?: number | null
          night_game_wins?: number | null
          season: number
          team_id: number
          updated_at?: string | null
          vs_left_losses?: number | null
          vs_left_wins?: number | null
          vs_right_losses?: number | null
          vs_right_wins?: number | null
        }
        Update: {
          away_losses?: number | null
          away_wins?: number | null
          created_at?: string | null
          day_game_losses?: number | null
          day_game_wins?: number | null
          home_losses?: number | null
          home_wins?: number | null
          id?: number
          last_10_losses?: number | null
          last_10_wins?: number | null
          last_30_losses?: number | null
          last_30_wins?: number | null
          night_game_losses?: number | null
          night_game_wins?: number | null
          season?: number
          team_id?: number
          updated_at?: string | null
          vs_left_losses?: number | null
          vs_left_wins?: number | null
          vs_right_losses?: number | null
          vs_right_wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "team_trends_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          abbreviation: string
          city: string | null
          created_at: string | null
          division: string
          id: number
          league: string | null
          name: string
          team_id: number | null
          updated_at: string | null
          venue_name: string | null
        }
        Insert: {
          abbreviation: string
          city?: string | null
          created_at?: string | null
          division: string
          id?: number
          league?: string | null
          name: string
          team_id?: number | null
          updated_at?: string | null
          venue_name?: string | null
        }
        Update: {
          abbreviation?: string
          city?: string | null
          created_at?: string | null
          division?: string
          id?: number
          league?: string | null
          name?: string
          team_id?: number | null
          updated_at?: string | null
          venue_name?: string | null
        }
        Relationships: []
      }
      weather_data: {
        Row: {
          condition: string | null
          created_at: string | null
          game_id: number
          humidity_percent: number | null
          id: number
          precipitation_inches: number | null
          pressure_inches: number | null
          temperature_f: number | null
          updated_at: string | null
          visibility_miles: number | null
          wind_direction: string | null
          wind_direction_degrees: number | null
          wind_speed_mph: number | null
        }
        Insert: {
          condition?: string | null
          created_at?: string | null
          game_id: number
          humidity_percent?: number | null
          id?: number
          precipitation_inches?: number | null
          pressure_inches?: number | null
          temperature_f?: number | null
          updated_at?: string | null
          visibility_miles?: number | null
          wind_direction?: string | null
          wind_direction_degrees?: number | null
          wind_speed_mph?: number | null
        }
        Update: {
          condition?: string | null
          created_at?: string | null
          game_id?: number
          humidity_percent?: number | null
          id?: number
          precipitation_inches?: number | null
          pressure_inches?: number | null
          temperature_f?: number | null
          updated_at?: string | null
          visibility_miles?: number | null
          wind_direction?: string | null
          wind_direction_degrees?: number | null
          wind_speed_mph?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_data_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["game_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
