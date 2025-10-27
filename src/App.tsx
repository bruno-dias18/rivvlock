import React, { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { I18nextProvider } from "react-i18next";
import { AuthProvider } from "./contexts/AuthContext";
import { queryClient } from "./lib/queryClient";
import i18n from "./i18n/config";
import "./index.css";

// Eager-loaded pages (critical path)
import AuthPage from "./pages/AuthPage";
import RegistrationSuccessPage from "./pages/RegistrationSuccessPage";
import NotFound from "./pages/NotFound";

// Lazy load all dashboard pages for better performance
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage"));
const QuotesPage = lazy(() => import("./pages/QuotesPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const PaymentLinkPage = lazy(() => import("./pages/PaymentLinkPage"));
const PaymentSuccessPage = lazy(() => import("./pages/PaymentSuccessPage"));
const ActivityHistoryPage = lazy(() => import("./pages/ActivityHistoryPage"));
const AnnualReportsPage = lazy(() => import("./pages/AnnualReportsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const AdminDisputesPage = lazy(() => import("./pages/AdminDisputesPage"));
const AdminProblematicTransactionsPage = lazy(() => import("./pages/AdminProblematicTransactionsPage"));
const AdminLogsPage = lazy(() => import("./pages/AdminLogsPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AdminSettingsPage = lazy(() => import("./pages/AdminSettingsPage"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const QuoteViewPage = lazy(() => import("./pages/QuoteViewPage"));
const FAQPage = lazy(() => import("./pages/FAQPage"));
const ApiDocsPage = lazy(() => import("./pages/ApiDocsPage"));
const CompetitorAnalysisPage = lazy(() => import("./pages/CompetitorAnalysisPage"));
const SellerVerification = lazy(() => import("./pages/SellerVerification"));
const AdminKycVerification = lazy(() => import("./pages/AdminKycVerification"));
const AdminAdyenPayouts = lazy(() => import("./pages/AdminAdyenPayouts"));

// Eager-loaded critical components (avoid loading screens)
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { UserRoute } from "./components/UserRoute";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import { ScrollToTop } from "./components/ScrollToTop";
import { RealtimeActivitySync } from "./components/RealtimeActivitySync";
import { PageSkeleton } from "./components/PageSkeleton";

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
            Suspense,
            { fallback: React.createElement(PageSkeleton) },
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
               React.createElement(Route, { path: "/", element: React.createElement(Navigate, { to: "/auth", replace: true }) }),
               React.createElement(Route, { path: "/auth", element: React.createElement(AuthPage) }),
               React.createElement(Route, { path: "/registration-success", element: React.createElement(RegistrationSuccessPage) }),
               React.createElement(Route, { path: "/terms", element: React.createElement(TermsOfServicePage) }),
               React.createElement(Route, { path: "/privacy", element: React.createElement(PrivacyPolicyPage) }),
               React.createElement(Route, { path: "/contact", element: React.createElement(ContactPage) }),
               React.createElement(Route, { path: "/faq", element: React.createElement(FAQPage) }),
               React.createElement(Route, { path: "/api-docs", element: React.createElement(ApiDocsPage) }),
               React.createElement(Route, { path: "/competitor-analysis", element: React.createElement(CompetitorAnalysisPage) }),
               React.createElement(Route, { path: "/join/:token", element: React.createElement(PaymentLinkPage) }),
               React.createElement(Route, { path: "/join-transaction/:token", element: React.createElement(PaymentLinkPage) }),
               React.createElement(Route, { path: "/payment-link/:token", element: React.createElement(PaymentLinkPage) }),
               React.createElement(Route, { path: "/quote-view/:token", element: React.createElement(QuoteViewPage) }),
               React.createElement(Route, { 
                 path: "/payment-success", 
                 element: React.createElement(ProtectedRoute, null, React.createElement(PaymentSuccessPage))
               }),
                // Legacy redirects to preserve old links
                React.createElement(Route, { path: "/transactions", element: React.createElement(Navigate, { to: "/dashboard/transactions", replace: true }) }),
                React.createElement(Route, { path: "/quotes", element: React.createElement(Navigate, { to: "/dashboard/quotes", replace: true }) }),
                React.createElement(Route, { path: "/profile", element: React.createElement(Navigate, { to: "/dashboard/profile", replace: true }) }),
                React.createElement(Route, { path: "/admin", element: React.createElement(Navigate, { to: "/dashboard/admin", replace: true }) }),
                React.createElement(Route, { path: "/admin/disputes", element: React.createElement(Navigate, { to: "/dashboard/admin/disputes", replace: true }) }),
               React.createElement(Route, { 
                  path: "/dashboard", 
                  element: React.createElement(ProtectedRoute, null, React.createElement(UserRoute, null, React.createElement(DashboardPage)))
                }),
                React.createElement(Route, { 
                  path: "/dashboard/transactions", 
                  element: React.createElement(ProtectedRoute, null, React.createElement(UserRoute, null, React.createElement(TransactionsPage)))
                }),
                React.createElement(Route, { 
                  path: "/dashboard/quotes", 
                  element: React.createElement(ProtectedRoute, null, React.createElement(UserRoute, null, React.createElement(QuotesPage)))
                }),
                React.createElement(Route, { 
                  path: "/dashboard/profile", 
                  element: React.createElement(ProtectedRoute, null, React.createElement(UserRoute, null, React.createElement(ProfilePage)))
                }),
                React.createElement(Route, { 
                  path: "/dashboard/reports", 
                  element: React.createElement(ProtectedRoute, null, React.createElement(UserRoute, null, React.createElement(AnnualReportsPage)))
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
                 path: "/dashboard/admin/problematic", 
                 element: React.createElement(ProtectedRoute, null, React.createElement(AdminRoute, null, React.createElement(AdminProblematicTransactionsPage)))
               }),
               React.createElement(Route, { 
                 path: "/dashboard/admin/logs", 
                 element: React.createElement(ProtectedRoute, null, React.createElement(AdminRoute, null, React.createElement(AdminLogsPage)))
               }),
               React.createElement(Route, { 
                 path: "/dashboard/admin/users", 
                 element: React.createElement(ProtectedRoute, null, React.createElement(AdminRoute, null, React.createElement(AdminUsersPage)))
               }),
               React.createElement(Route, { 
                 path: "/dashboard/admin/settings", 
                 element: React.createElement(ProtectedRoute, null, React.createElement(AdminRoute, null, React.createElement(AdminSettingsPage)))
               }),
               React.createElement(Route, { 
                 path: "/dashboard/admin/kyc", 
                 element: React.createElement(ProtectedRoute, null, React.createElement(AdminRoute, null, React.createElement(AdminKycVerification)))
               }),
               React.createElement(Route, { 
                 path: "/dashboard/admin/payouts", 
                 element: React.createElement(ProtectedRoute, null, React.createElement(AdminRoute, null, React.createElement(AdminAdyenPayouts)))
               }),
               React.createElement(Route, { 
                 path: "/seller/verification", 
                 element: React.createElement(ProtectedRoute, null, React.createElement(UserRoute, null, React.createElement(SellerVerification)))
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
    )
  );
};

export default App;