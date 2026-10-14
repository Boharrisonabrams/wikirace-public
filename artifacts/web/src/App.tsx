import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import HomePage from "@/pages/home";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import GamePage from "@/pages/game";
import PracticePage from "@/pages/practice";
import LeaderboardPage from "@/pages/leaderboard";
import ProfilePage from "@/pages/profile";
import ChallengePage from "@/pages/challenge";
import AuthCallbackPage from "@/pages/auth-callback";
import PrivacyPage from "@/pages/privacy";
import SupportPage from "@/pages/support";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ConfigBanner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--wiki-chrome)] px-4">
      <div className="w-full max-w-md border border-[var(--wiki-rule)] bg-white p-8 text-center">
        <h1 className="mb-4 font-serif text-4xl font-semibold">WikiRace</h1>
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-5 text-left">
          <p className="mb-2 font-semibold text-amber-800">⚙️ Setup required</p>
          <p className="mb-3 text-sm text-amber-700">
            Add your Supabase credentials to the environment:
          </p>
          <ul className="space-y-1 font-mono text-sm text-amber-700">
            <li>• VITE_SUPABASE_URL</li>
            <li>• VITE_SUPABASE_ANON_KEY</li>
          </ul>
        </div>
        <p className="text-sm text-muted-foreground">
          The app loads automatically once secrets are set.
        </p>
      </div>
    </div>
  );
}

/** Gate for signed-in pages; sends visitors to login with a return path. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--wiki-chrome)]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--wiki-hairline)] border-t-[var(--wiki-blue)]" />
      </div>
    );
  }
  if (!user) {
    const next = encodeURIComponent(
      window.location.pathname + window.location.search,
    );
    return <Redirect to={`/login?next=${next}`} />;
  }
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/game">
        <RequireAuth>
          <GamePage />
        </RequireAuth>
      </Route>
      <Route path="/practice" component={PracticePage} />
      <Route path="/leaderboard" component={LeaderboardPage} />
      <Route path="/profile">
        <RequireAuth>
          <ProfilePage />
        </RequireAuth>
      </Route>
      <Route path="/challenge/:id" component={ChallengePage} />
      <Route path="/auth/callback" component={AuthCallbackPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/support" component={SupportPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        {isSupabaseConfigured() ? <Router /> : <ConfigBanner />}
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
