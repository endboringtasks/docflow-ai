import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CompanyProvider } from "@/hooks/useCompany";
import { ImpersonationProvider } from "@/hooks/useImpersonation";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminCompanies from "./pages/admin/Companies";
import AdminUsers from "./pages/admin/Users";
import AdminBilling from "./pages/admin/Billing";
import AdminWebhooks from "./pages/admin/Webhooks";
import AdminWebhookMonitoring from "./pages/admin/WebhookMonitoring";
import AdminSettings from "./pages/admin/Settings";
import AdminAuditLogs from "./pages/admin/AuditLogs";
import Onboarding from "./pages/Onboarding";
import MigrationDashboard from "./pages/migration/Dashboard";
import MigrationClients from "./pages/migration/Clients";
import MigrationClientDetail from "./pages/migration/ClientDetail";
import MigrationMatters from "./pages/migration/Matters";
import MigrationMatterDetail from "./pages/migration/MatterDetail";
import MigrationDocumentChecklist from "./pages/migration/DocumentTemplates";
import AuditDashboard from "./pages/audit/Dashboard";
import HRDashboard from "./pages/hr/Dashboard";
import Billing from "./pages/Billing";
import Settings from "./pages/Settings";
import SeoChecklist from "./pages/SeoChecklist";
import ClientPortal from "./pages/client-portal/ClientPortal";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CompanyProvider>
        <ImpersonationProvider>
          <TooltipProvider>
            <ImpersonationBanner />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
              {/* Public */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/seo-checklist" element={<SeoChecklist />} />
              <Route path="/client-portal" element={<ClientPortal />} />
              
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
              <Route path="/app/migration/visa-applications" element={
                <ProtectedRoute>
                  <MigrationMatters />
                </ProtectedRoute>
              } />
              <Route path="/app/migration/visa-applications/:matterId" element={
                <ProtectedRoute>
                  <MigrationMatterDetail />
                </ProtectedRoute>
              } />
              <Route path="/app/migration/document-checklist" element={
                <ProtectedRoute>
                  <MigrationDocumentChecklist />
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
              
              {/* Protected: Settings */}
              <Route path="/app/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
              
              {/* Admin Panel */}
              <Route path="/admin" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
              <Route path="/admin/companies" element={<AdminProtectedRoute><AdminCompanies /></AdminProtectedRoute>} />
              <Route path="/admin/users" element={<AdminProtectedRoute><AdminUsers /></AdminProtectedRoute>} />
              <Route path="/admin/billing" element={<AdminProtectedRoute><AdminBilling /></AdminProtectedRoute>} />
              <Route path="/admin/webhooks" element={<AdminProtectedRoute><AdminWebhooks /></AdminProtectedRoute>} />
              <Route path="/admin/webhook-monitoring" element={<AdminProtectedRoute><AdminWebhookMonitoring /></AdminProtectedRoute>} />
              <Route path="/admin/settings" element={<AdminProtectedRoute><AdminSettings /></AdminProtectedRoute>} />
              <Route path="/admin/audit-logs" element={<AdminProtectedRoute><AdminAuditLogs /></AdminProtectedRoute>} />
              
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </ImpersonationProvider>
      </CompanyProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
