import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { I18nextProvider } from "react-i18next";
import HomePage from "./pages/HomePage";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import PaymentLinkPage from "./pages/PaymentLinkPage";
import TransactionJoinPage from "./pages/TransactionJoinPage";
import ActivityHistoryPage from "./pages/ActivityHistoryPage";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { DashboardLayout } from "./components/DashboardLayout";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import i18n from "./i18n/config";
import "./index.css";

const queryClient = new QueryClient();

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
        React.createElement(Toaster, { position: "top-right" }),
        React.createElement(
          GlobalErrorBoundary,
          null,
          React.createElement(
            BrowserRouter,
            null,
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: "/", element: React.createElement(HomePage) }),
              React.createElement(Route, { path: "/auth", element: React.createElement(AuthPage) }),
              React.createElement(Route, { path: "/join/:token", element: React.createElement(TransactionJoinPage) }),
              React.createElement(Route, { path: "/join-transaction/:token", element: React.createElement(TransactionJoinPage) }),
              React.createElement(Route, { path: "/payment-link/:token", element: React.createElement(PaymentLinkPage) }),
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
                path: "/dashboard/admin", 
                element: React.createElement(ProtectedRoute, null, React.createElement(AdminRoute, null, React.createElement(AdminPage)))
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