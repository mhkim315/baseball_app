import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Router, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AnimatedPage } from "./components/AnimatedPage";
import Home from "./pages/Home";
import GameDetail from "./pages/GameDetail";
import CalendarPage from "./pages/CalendarPage";
import Stadium from "./pages/Stadium";
import Cheer from "./pages/Cheer";
import Standings from "./pages/Standings";
import BetaPage from "./pages/Beta";
import TermsPage from "./pages/Terms";
import PrivacyPage from "./pages/Privacy";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import { useOnlineStatus } from "./hooks/useOnlineStatus";

const withAnimation = (Page: React.ComponentType) => () =>
  <AnimatedPage><Page /></AnimatedPage>;

function AppRoutes() {
  return (
    <Switch>
      <Route path={"/"} component={withAnimation(Home)} />
      <Route path={"/game/:id"} component={withAnimation(GameDetail)} />
      <Route path={"/calendar"} component={withAnimation(CalendarPage)} />
      <Route path={"/stadium"} component={withAnimation(Stadium)} />
      <Route path={"/cheer"} component={withAnimation(Cheer)} />
      <Route path={"/rank"} component={withAnimation(Standings)} />
      <Route path={"/app"} component={withAnimation(BetaPage)} />
      <Route path={"/terms"} component={withAnimation(TermsPage)} />
      <Route path={"/privacy"} component={withAnimation(PrivacyPage)} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useOnlineStatus();
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Router base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Toaster />
            <Header />
            <AppRoutes />
            <BottomNav />
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
