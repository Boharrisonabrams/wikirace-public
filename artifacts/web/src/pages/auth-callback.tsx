import { useEffect } from "react";
import { useLocation } from "wouter";
import { nextTargetFromSearch } from "@/lib/auth-redirect";
import { getSupabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [, navigate] = useLocation();
  const next = nextTargetFromSearch(window.location.search);

  useEffect(() => {
    const {
      data: { subscription },
    } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        navigate(next);
      }
    });
    // Also check immediately
    getSupabase()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (session) {
          navigate(next);
        } else {
          // Wait a moment for the session to be established from the URL hash
          setTimeout(() => navigate(next), 2000);
        }
      });
    return () => subscription.unsubscribe();
  }, [navigate, next]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
