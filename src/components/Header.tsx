
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, TrendingUp } from "lucide-react";

const Header = () => {
  return (
    <header className="bg-background border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Grand Slam Forecasts</h1>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <Button variant="ghost" className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Today's Games</span>
            </Button>
            <Button variant="ghost" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Predictions</span>
            </Button>
            <Button variant="ghost">Teams</Button>
            <Button variant="ghost">Stats</Button>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
