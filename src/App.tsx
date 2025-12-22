import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CompanyProvider } from "@/hooks/useCompany";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import MigrationDashboard from "./pages/migration/Dashboard";
import MigrationClients from "./pages/migration/Clients";
import MigrationMatters from "./pages/migration/Matters";
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
              <Route path="/onboarding" element={<Onboarding />} />
              
              {/* Migration Niche */}
              <Route path="/app/migration/dashboard" element={<MigrationDashboard />} />
              <Route path="/app/migration/clients" element={<MigrationClients />} />
              <Route path="/app/migration/matters" element={<MigrationMatters />} />
              
              {/* Audit Niche (Stubs) */}
              <Route path="/app/audit/dashboard" element={<AuditDashboard />} />
              <Route path="/app/audit/clients" element={<AuditDashboard />} />
              <Route path="/app/audit/engagements" element={<AuditDashboard />} />
              
              {/* HR Niche (Stubs) */}
              <Route path="/app/hr/dashboard" element={<HRDashboard />} />
              <Route path="/app/hr/employees" element={<HRDashboard />} />
              <Route path="/app/hr/cases" element={<HRDashboard />} />
              
              {/* Billing */}
              <Route path="/app/billing" element={<Billing />} />
              
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
