import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, AlertCircle, XCircle, TrendingUp } from 'lucide-react';

interface PredictionQualityIndicatorProps {
  prediction: {
    confidence_score?: number;
    key_factors?: any;
    prediction_method?: string;
  };
}

const PredictionQualityIndicator: React.FC<PredictionQualityIndicatorProps> = ({ prediction }) => {
  const confidence = prediction.confidence_score || 0;
  const method = prediction.prediction_method || 'unknown';
  const dataQuality = prediction.key_factors?.lineup_quality || 0;

  const getQualityLevel = () => {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  };

  const getQualityIcon = () => {
    const level = getQualityLevel();
    switch (level) {
      case 'high':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'medium':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getMethodLabel = () => {
    switch (method) {
      case 'monte_carlo':
        return 'Monte Carlo';
      case 'enhanced_stats':
        return 'Enhanced Stats';
      case 'adjusted_team_stats':
        return 'Basic Stats';
      default:
        return 'Unknown';
    }
  };

  const getMethodVariant = () => {
    switch (method) {
      case 'monte_carlo':
        return 'default';
      case 'enhanced_stats':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              {getQualityIcon()}
              <span className="text-sm font-medium">
                {Math.round(confidence * 100)}%
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">Prediction Quality</p>
              <p>Confidence: {Math.round(confidence * 100)}%</p>
              <p>Data Quality: {Math.round(dataQuality * 100)}%</p>
              <p>Method: {getMethodLabel()}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Badge variant={getMethodVariant()} className="text-xs">
        <TrendingUp className="h-3 w-3 mr-1" />
        {getMethodLabel()}
      </Badge>
    </div>
  );
};

export default PredictionQualityIndicator;