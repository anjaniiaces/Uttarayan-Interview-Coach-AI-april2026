import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

// Page Imports
import Home from "./pages/Home";
import InterviewDetail from "./pages/InterviewDetail";
import QuestionSession from "./pages/QuestionSession";
import SessionReport from "./pages/SessionReport";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/interview/:id" component={InterviewDetail} />
      <Route path="/interview/:interviewId/question/:id" component={QuestionSession} />
      <Route path="/interview/:id/report" component={SessionReport} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
