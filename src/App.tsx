import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthPage } from "./components/auth/AuthPage";
import { AdminRoute } from "./components/auth/AdminRoute";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import Index from "./pages/Index";
import { Dashboard } from "./pages/Dashboard";
import { CreateTransaction } from "./pages/CreateTransaction";
import { PaymentLink } from "./pages/PaymentLink";
import { JoinTransaction } from "./pages/JoinTransaction";
import { Transactions } from "./pages/Transactions";
import { Profile } from "./pages/Profile";
import { Security } from "./pages/Security";
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
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/create-transaction" element={<ProtectedRoute><CreateTransaction /></ProtectedRoute>} />
            <Route path="/join-transaction/:token" element={<JoinTransaction />} />
            <Route path="/payment-link/:token" element={<PaymentLink />} />
            <Route path="/payment/:token" element={<PaymentLink />} />
            <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
