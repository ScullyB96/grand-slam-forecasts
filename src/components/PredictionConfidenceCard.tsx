import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Shield, AlertTriangle, CheckCircle, BarChart3 } from 'lucide-react';
import { GamePrediction } from '@/hooks/usePredictions';

interface PredictionConfidenceCardProps {
  prediction: GamePrediction;
  gameData?: {
    home_team: { name: string; abbreviation: string };
    away_team: { name: string; abbreviation: string };
  };
}

const PredictionConfidenceCard: React.FC<PredictionConfidenceCardProps> = ({ 
  prediction, 
  gameData 
}) => {
  const confidence = prediction.confidence_score || 0;
  const keyFactors = prediction.key_factors as any || {};
  
  const getConfidenceLevel = (score: number) => {
    if (score >= 0.8) return { level: 'Very High', color: 'text-green-600', variant: 'default' as const };
    if (score >= 0.7) return { level: 'High', color: 'text-green-500', variant: 'default' as const };
    if (score >= 0.6) return { level: 'Medium', color: 'text-yellow-600', variant: 'secondary' as const };
    if (score >= 0.5) return { level: 'Low', color: 'text-orange-600', variant: 'secondary' as const };
    return { level: 'Very Low', color: 'text-red-600', variant: 'destructive' as const };
  };

  const confidenceInfo = getConfidenceLevel(confidence);

  const getDataQualityFactors = () => {
    const factors = [];
    
    // Simulated data quality indicators based on key factors
    if (keyFactors.lineup_quality >= 0.8) {
      factors.push({ name: 'Official Lineups', status: 'good', icon: CheckCircle });
    } else if (keyFactors.lineup_quality >= 0.5) {
      factors.push({ name: 'Projected Lineups', status: 'medium', icon: AlertTriangle });
    } else {
      factors.push({ name: 'Missing Lineups', status: 'poor', icon: AlertTriangle });
    }

    if (keyFactors.stats_completeness >= 0.8) {
      factors.push({ name: 'Complete Stats', status: 'good', icon: CheckCircle });
    } else {
      factors.push({ name: 'Partial Stats', status: 'medium', icon: AlertTriangle });
    }

    if (keyFactors.historical_data >= 0.7) {
      factors.push({ name: 'Rich History', status: 'good', icon: CheckCircle });
    } else {
      factors.push({ name: 'Limited History', status: 'medium', icon: AlertTriangle });
    }

    return factors;
  };

  const dataFactors = getDataQualityFactors();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5" />
          Prediction Confidence
        </CardTitle>
        <CardDescription>
          AI model confidence and data quality assessment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Confidence */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Confidence</span>
            <Badge variant={confidenceInfo.variant}>
              {confidenceInfo.level}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Confidence Score</span>
              <span className={`font-bold ${confidenceInfo.color}`}>
                {Math.round(confidence * 100)}%
              </span>
            </div>
            <Progress value={confidence * 100} className="h-2" />
          </div>
        </div>

        {/* Win Probability Confidence */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-medium">Win Probability Assessment</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{gameData?.home_team.abbreviation || 'Home'}</span>
                <span className="font-semibold">{Math.round(prediction.home_win_probability * 100)}%</span>
              </div>
              <Progress value={prediction.home_win_probability * 100} className="h-1" />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{gameData?.away_team.abbreviation || 'Away'}</span>
                <span className="font-semibold">{Math.round(prediction.away_win_probability * 100)}%</span>
              </div>
              <Progress value={prediction.away_win_probability * 100} className="h-1" />
            </div>
          </div>
        </div>

        {/* Data Quality Factors */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm font-medium">Data Quality Factors</span>
          </div>
          
          <div className="space-y-2">
            {dataFactors.map((factor, index) => {
              const IconComponent = factor.icon;
              return (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <IconComponent className={`h-4 w-4 ${
                      factor.status === 'good' ? 'text-green-500' :
                      factor.status === 'medium' ? 'text-yellow-500' : 'text-red-500'
                    }`} />
                    <span>{factor.name}</span>
                  </div>
                  <Badge variant={factor.status === 'good' ? 'default' : 'secondary'} className="text-xs">
                    {factor.status === 'good' ? 'Good' : factor.status === 'medium' ? 'OK' : 'Poor'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Key Prediction Factors */}
        {keyFactors.top_factors && (
          <div className="space-y-3">
            <span className="text-sm font-medium">Key Factors</span>
            <div className="space-y-2">
              {keyFactors.top_factors.slice(0, 3).map((factor: any, index: number) => (
                <div key={index} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                  <span>{factor.name}</span>
                  <span className="font-medium">{factor.impact > 0 ? '+' : ''}{Math.round(factor.impact * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confidence Explanation */}
        <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded">
          <p><strong>Confidence Factors:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Data completeness and recency</li>
            <li>Model training accuracy</li>
            <li>Historical prediction performance</li>
            <li>Quality of input features</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default PredictionConfidenceCard;