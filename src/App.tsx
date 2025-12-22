import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CompanyProvider } from "@/hooks/useCompany";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import MigrationDashboard from "./pages/migration/Dashboard";
import MigrationClients from "./pages/migration/Clients";
import MigrationClientDetail from "./pages/migration/ClientDetail";
import MigrationMatters from "./pages/migration/Matters";
import MigrationMatterDetail from "./pages/migration/MatterDetail";
import AuditDashboard from "./pages/audit/Dashboard";
import HRDashboard from "./pages/hr/Dashboard";
import Billing from "./pages/Billing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CompanyProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              
              {/* Protected: Onboarding */}
              <Route path="/onboarding" element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              } />
              
              {/* Protected: Migration Niche */}
              <Route path="/app/migration/dashboard" element={
                <ProtectedRoute>
                  <MigrationDashboard />
                </ProtectedRoute>
              } />
              <Route path="/app/migration/clients" element={
                <ProtectedRoute>
                  <MigrationClients />
                </ProtectedRoute>
              } />
              <Route path="/app/migration/clients/:clientId" element={
                <ProtectedRoute>
                  <MigrationClientDetail />
                </ProtectedRoute>
              } />
              <Route path="/app/migration/matters" element={
                <ProtectedRoute>
                  <MigrationMatters />
                </ProtectedRoute>
              } />
              <Route path="/app/migration/matters/:matterId" element={
                <ProtectedRoute>
                  <MigrationMatterDetail />
                </ProtectedRoute>
              } />
              
              {/* Protected: Audit Niche (Stubs) */}
              <Route path="/app/audit/dashboard" element={
                <ProtectedRoute>
                  <AuditDashboard />
                </ProtectedRoute>
              } />
              <Route path="/app/audit/clients" element={
                <ProtectedRoute>
                  <AuditDashboard />
                </ProtectedRoute>
              } />
              <Route path="/app/audit/engagements" element={
                <ProtectedRoute>
                  <AuditDashboard />
                </ProtectedRoute>
              } />
              
              {/* Protected: HR Niche (Stubs) */}
              <Route path="/app/hr/dashboard" element={
                <ProtectedRoute>
                  <HRDashboard />
                </ProtectedRoute>
              } />
              <Route path="/app/hr/employees" element={
                <ProtectedRoute>
                  <HRDashboard />
                </ProtectedRoute>
              } />
              <Route path="/app/hr/cases" element={
                <ProtectedRoute>
                  <HRDashboard />
                </ProtectedRoute>
              } />
              
              {/* Protected: Billing */}
              <Route path="/app/billing" element={
                <ProtectedRoute>
                  <Billing />
                </ProtectedRoute>
              } />
              
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CompanyProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
