import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { I18nextProvider } from "react-i18next";
import HomePage from "./pages/HomePage";
import AuthPage from "./pages/AuthPage";
import RegistrationSuccessPage from "./pages/RegistrationSuccessPage";
import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import AdminDisputesPage from "./pages/AdminDisputesPage";
import PaymentLinkPage from "./pages/PaymentLinkPage";

import ActivityHistoryPage from "./pages/ActivityHistoryPage";
import AnnualReportsPage from "./pages/AnnualReportsPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import ContactPage from "./pages/ContactPage";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { DashboardLayout } from "./components/DashboardLayout";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import { ScrollToTop } from "./components/ScrollToTop";
import { RealtimeActivitySync } from "./components/RealtimeActivitySync";
import { queryClient } from "./lib/queryClient";
import i18n from "./i18n/config";
import "./index.css";

const App: React.FC = () => {
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(
      I18nextProvider,
      { i18n },
      React.createElement(
        AuthProvider,
        null,
        React.createElement(RealtimeActivitySync),
        React.createElement(Toaster, { position: "top-right" }),
        React.createElement(
          GlobalErrorBoundary,
          null,
          React.createElement(
            BrowserRouter,
            null,
            React.createElement(ScrollToTop),
            React.createElement(
              Routes,
              null,
               React.createElement(Route, { path: "/", element: React.createElement(HomePage) }),
               React.createElement(Route, { path: "/auth", element: React.createElement(AuthPage) }),
               React.createElement(Route, { path: "/registration-success", element: React.createElement(RegistrationSuccessPage) }),
               React.createElement(Route, { path: "/terms", element: React.createElement(TermsOfServicePage) }),
               React.createElement(Route, { path: "/contact", element: React.createElement(ContactPage) }),
               React.createElement(Route, { path: "/join/:token", element: React.createElement(PaymentLinkPage) }),
               React.createElement(Route, { path: "/join-transaction/:token", element: React.createElement(PaymentLinkPage) }),
               React.createElement(Route, { path: "/payment-link/:token", element: React.createElement(PaymentLinkPage) }),
               // Legacy redirects to preserve old links
               React.createElement(Route, { path: "/transactions", element: React.createElement(Navigate, { to: "/dashboard/transactions", replace: true }) }),
               React.createElement(Route, { path: "/profile", element: React.createElement(Navigate, { to: "/dashboard/profile", replace: true }) }),
               React.createElement(Route, { path: "/admin", element: React.createElement(Navigate, { to: "/dashboard/admin", replace: true }) }),
               React.createElement(Route, { path: "/admin/disputes", element: React.createElement(Navigate, { to: "/dashboard/admin/disputes", replace: true }) }),
              React.createElement(Route, { 
                path: "/dashboard", 
                element: React.createElement(ProtectedRoute, null, React.createElement(DashboardPage))
              }),
              React.createElement(Route, { 
                path: "/dashboard/transactions", 
                element: React.createElement(ProtectedRoute, null, React.createElement(TransactionsPage))
              }),
              React.createElement(Route, { 
                path: "/dashboard/profile", 
                element: React.createElement(ProtectedRoute, null, React.createElement(ProfilePage))
              }),
              React.createElement(Route, { 
                path: "/dashboard/reports", 
                element: React.createElement(ProtectedRoute, null, React.createElement(AnnualReportsPage))
              }),
              React.createElement(Route, { 
                path: "/dashboard/admin", 
                element: React.createElement(ProtectedRoute, null, React.createElement(AdminRoute, null, React.createElement(AdminPage)))
              }),
              React.createElement(Route, { 
                path: "/dashboard/admin/disputes", 
                element: React.createElement(ProtectedRoute, null, React.createElement(AdminRoute, null, React.createElement(AdminDisputesPage)))
              }),
              React.createElement(Route, { 
                path: "/activity-history", 
                element: React.createElement(ProtectedRoute, null, React.createElement(ActivityHistoryPage))
              }),
              React.createElement(Route, { path: "*", element: React.createElement(NotFound) })
            )
          )
        )
      )
    )
  );
};

export default App;