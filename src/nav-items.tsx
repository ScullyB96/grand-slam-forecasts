
import { HomeIcon, BarChart3, TrendingUp, Calendar, Settings } from "lucide-react";
import HomePage from "./pages/HomePage.tsx";
import Stats from "./pages/Stats.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Predictions from "./pages/Predictions.tsx";
import Admin from "./pages/Admin.tsx";

/**
 * Central place for defining the navigation items. Used for navigation components and routing.
 */
export const navItems = [
  {
    title: "Home",
    to: "/",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <HomePage />,
  },
  {
    title: "Predictions",
    to: "/predictions",
    icon: <TrendingUp className="h-4 w-4" />,
    page: <Predictions />,
  },
  {
    title: "Admin",
    to: "/admin",
    icon: <Settings className="h-4 w-4" />,
    page: <Admin />,
  },
  // Hidden until ready
  // {
  //   title: "Dashboard",
  //   to: "/dashboard",
  //   icon: <Calendar className="h-4 w-4" />,
  //   page: <Dashboard />,
  // },
  // {
  //   title: "Stats",
  //   to: "/stats",
  //   icon: <BarChart3 className="h-4 w-4" />,
  //   page: <Stats />,
  // },
];
