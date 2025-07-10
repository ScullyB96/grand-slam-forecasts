
import React from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, BarChart3, Calendar, Target } from 'lucide-react';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center py-16 mb-12">
          <h1 className="text-5xl font-bold text-foreground mb-6">
            MLB Predictions Hub
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Advanced statistical analysis and machine learning predictions for Major League Baseball. 
            Get insights powered by comprehensive data and Monte Carlo simulations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8">
              <Link to="/predictions">
                <TrendingUp className="mr-2 h-5 w-5" />
                View Predictions
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8">
              <Link to="/stats">
                <BarChart3 className="mr-2 h-5 w-5" />
                Browse Statistics
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="text-center">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <Target className="h-6 w-6" />
                Game Predictions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                AI-powered win probability analysis with detailed breakdowns of key factors
                affecting game outcomes.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <BarChart3 className="h-6 w-6" />
                Advanced Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Comprehensive player and team statistics with advanced metrics and 
                performance analytics.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <Calendar className="h-6 w-6" />
                Live Updates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Real-time game data and prediction updates throughout the baseball season
                with live scoring.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Navigation */}
        <div className="bg-muted/50 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-6">
            Explore today's games and get instant predictions powered by machine learning
          </p>
          <Button asChild>
            <Link to="/predictions">
              Explore Today's Games
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
