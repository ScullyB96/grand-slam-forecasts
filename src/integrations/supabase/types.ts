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
      game_predictions: {
        Row: {
          away_win_probability: number
          confidence_score: number | null
          created_at: string | null
          game_id: number
          home_win_probability: number
          id: number
          key_factors: Json | null
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
            isOneToOne: false
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
      teams: {
        Row: {
          abbreviation: string
          city: string | null
          created_at: string | null
          division: string
          id: number
          league: string
          name: string
          updated_at: string | null
        }
        Insert: {
          abbreviation: string
          city?: string | null
          created_at?: string | null
          division: string
          id?: number
          league: string
          name: string
          updated_at?: string | null
        }
        Update: {
          abbreviation?: string
          city?: string | null
          created_at?: string | null
          division?: string
          id?: number
          league?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
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
