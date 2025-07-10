import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  startDate: string;
  endDate?: string;
  includeDetails?: boolean;
}

interface GameAnalysis {
  game_id: number;
  game_date: string;
  home_team: string;
  away_team: string;
  predicted_home_win_prob: number;
  predicted_away_win_prob: number;
  predicted_home_score?: number;
  predicted_away_score?: number;
  actual_home_score?: number;
  actual_away_score?: number;
  actual_winner?: string;
  prediction_correct?: boolean;
  confidence_score?: number;
  score_error?: number;
}

serve(async (req) => {
  console.log('=== PREDICTION ANALYSIS FUNCTION STARTED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const requestBody: AnalysisRequest = await req.json();
    const { startDate, endDate = startDate, includeDetails = true } = requestBody;

    console.log('Analysis request:', { startDate, endDate, includeDetails });

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }

    // Get games with predictions and actual results
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select(`
        game_id,
        game_date,
        status,
        home_score,
        away_score,
        home_team:teams!games_home_team_id_fkey(name, abbreviation),
        away_team:teams!games_away_team_id_fkey(name, abbreviation),
        game_predictions(
          home_win_probability,
          away_win_probability,
          predicted_home_score,
          predicted_away_score,
          confidence_score,
          created_at
        )
      `)
      .gte('game_date', startDate)
      .lte('game_date', endDate)
      .eq('status', 'final')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);

    if (gamesError) {
      console.error('Error fetching games:', gamesError);
      throw gamesError;
    }

    console.log(`Found ${gamesData?.length || 0} completed games with scores`);

    if (!gamesData || gamesData.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No completed games found for the specified date range',
        analysis: {
          totalGames: 0,
          gamesWithPredictions: 0,
          accuracy: 0,
          avgConfidence: 0,
          avgScoreError: 0
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Analyze each game
    const gameAnalyses: GameAnalysis[] = [];
    let correctPredictions = 0;
    let totalPredictions = 0;
    let totalConfidence = 0;
    let totalScoreError = 0;
    let gamesWithScorePredictions = 0;

    for (const game of gamesData) {
      const prediction = game.game_predictions?.[0]; // Get the most recent prediction
      
      if (!prediction) {
        console.log(`No prediction found for game ${game.game_id}`);
        continue;
      }

      const actualHomeScore = game.home_score;
      const actualAwayScore = game.away_score;
      const actualWinner = actualHomeScore > actualAwayScore ? 'home' : 
                          actualAwayScore > actualHomeScore ? 'away' : 'tie';

      // Determine predicted winner
      const predictedWinner = prediction.home_win_probability > prediction.away_win_probability ? 'home' :
                             prediction.away_win_probability > prediction.home_win_probability ? 'away' : 'tie';

      const predictionCorrect = actualWinner === predictedWinner;
      
      // Calculate score error if we have score predictions
      let scoreError = null;
      if (prediction.predicted_home_score !== null && prediction.predicted_away_score !== null) {
        const homeError = Math.abs(prediction.predicted_home_score - actualHomeScore);
        const awayError = Math.abs(prediction.predicted_away_score - actualAwayScore);
        scoreError = (homeError + awayError) / 2; // Average error
        totalScoreError += scoreError;
        gamesWithScorePredictions++;
      }

      const analysis: GameAnalysis = {
        game_id: game.game_id,
        game_date: game.game_date,
        home_team: game.home_team.abbreviation,
        away_team: game.away_team.abbreviation,
        predicted_home_win_prob: prediction.home_win_probability,
        predicted_away_win_prob: prediction.away_win_probability,
        predicted_home_score: prediction.predicted_home_score,
        predicted_away_score: prediction.predicted_away_score,
        actual_home_score: actualHomeScore,
        actual_away_score: actualAwayScore,
        actual_winner: actualWinner,
        prediction_correct: predictionCorrect,
        confidence_score: prediction.confidence_score,
        score_error: scoreError
      };

      gameAnalyses.push(analysis);

      if (predictionCorrect) {
        correctPredictions++;
      }
      totalPredictions++;
      
      if (prediction.confidence_score) {
        totalConfidence += prediction.confidence_score;
      }
    }

    // Calculate overall metrics
    const accuracy = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0;
    const avgConfidence = totalPredictions > 0 ? totalConfidence / totalPredictions : 0;
    const avgScoreError = gamesWithScorePredictions > 0 ? totalScoreError / gamesWithScorePredictions : 0;

    // Store analysis results
    const analysisResults = {
      analysis_date: new Date().toISOString(),
      date_range: { start: startDate, end: endDate },
      total_games: gamesData.length,
      games_with_predictions: totalPredictions,
      correct_predictions: correctPredictions,
      accuracy_percentage: accuracy,
      avg_confidence_score: avgConfidence,
      avg_score_error: avgScoreError,
      games_with_score_predictions: gamesWithScorePredictions
    };

    // Log to prediction_performance table for tracking
    if (totalPredictions > 0) {
      for (const analysis of gameAnalyses) {
        try {
          await supabase
            .from('prediction_performance')
            .upsert({
              game_id: analysis.game_id,
              game_date: analysis.game_date,
              prediction_date: analysis.game_date, // Assuming prediction was made same day
              predicted_home_win_prob: analysis.predicted_home_win_prob,
              predicted_away_win_prob: analysis.predicted_away_win_prob,
              predicted_home_score: analysis.predicted_home_score,
              predicted_away_score: analysis.predicted_away_score,
              actual_home_score: analysis.actual_home_score,
              actual_away_score: analysis.actual_away_score,
              actual_winner: analysis.actual_winner,
              prediction_accuracy: analysis.prediction_correct ? 1.0 : 0.0,
              score_mae: analysis.score_error,
              confidence_score: analysis.confidence_score
            }, {
              onConflict: 'game_id,prediction_date'
            });
        } catch (error) {
          console.error(`Error storing analysis for game ${analysis.game_id}:`, error);
        }
      }
    }

    console.log('Analysis completed:', analysisResults);

    const response = {
      success: true,
      ...analysisResults,
      details: includeDetails ? gameAnalyses : undefined
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});