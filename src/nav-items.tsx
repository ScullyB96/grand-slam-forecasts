
import { HomeIcon, BarChart3Icon, TrendingUpIcon } from "lucide-react";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Stats from "./pages/Stats";

/**
 * Central place for defining the navigation items. Used for navigation components and routing.
 */
export const navItems = [
  {
    title: "Home",
    to: "/",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <Index />,
  },
  {
    title: "Dashboard",
    to: "/dashboard",
    icon: <BarChart3Icon className="h-4 w-4" />,
    page: <Dashboard />,
  },
  {
    title: "Statistics",
    to: "/stats", 
    icon: <TrendingUpIcon className="h-4 w-4" />,
    page: <Stats />,
  },
];
