import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthPage } from "./components/auth/AuthPage";
import Index from "./pages/Index";
import { Dashboard } from "./pages/Dashboard";
import { CreateTransaction } from "./pages/CreateTransaction";
import { PaymentLink } from "./pages/PaymentLink";
import { Transactions } from "./pages/Transactions";
import { Profile } from "./pages/Profile";
import { Admin } from "./pages/Admin";
import NotFound from "./pages/NotFound";
import "./i18n/config";
import { AuthProvider } from "@/contexts/AuthContext";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/create-transaction" element={<CreateTransaction />} />
            <Route path="/payment/:token" element={<PaymentLink />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<Admin />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
