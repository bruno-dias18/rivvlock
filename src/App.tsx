import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import HomePage from "./pages/HomePage";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import "./index.css";
import "./i18n/config";

const queryClient = new QueryClient();

const App: React.FC = () => {
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(
      AuthProvider,
      null,
      React.createElement(Toaster, { position: "top-right" }),
      React.createElement(
        BrowserRouter,
        null,
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: "/", element: React.createElement(HomePage) }),
          React.createElement(Route, { path: "/auth", element: React.createElement(AuthPage) }),
          React.createElement(Route, { 
            path: "/dashboard", 
            element: React.createElement(ProtectedRoute, null, React.createElement(DashboardPage))
          })
        )
      )
    )
  );
};

export default App;