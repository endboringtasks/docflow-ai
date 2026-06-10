import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type Niche = "migration" | "audit" | "hr";
type CompanyRole = "owner" | "admin" | "member" | "guest";

interface Company {
  id: string;
  name: string;
  niche: Niche;
  created_by: string;
  subscription_plan: string;
  subscription_status: string | null;
  created_at: string;
}

interface CompanyMembership {
  company_id: string;
  role: CompanyRole;
  company: Company;
}

interface CompanyContextType {
  currentCompany: Company | null;
  currentRole: CompanyRole | null;
  companies: CompanyMembership[];
  loading: boolean;
  switching: boolean;
  defaultCompanyReselected: Company | null;
  clearDefaultReselected: () => void;
  createCompany: (name: string, niche: Niche) => Promise<{ error: Error | null; company: Company | null }>;
  switchCompany: (companyId: string) => Promise<{ error: Error | null }>;
  refetch: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [companies, setCompanies] = useState<CompanyMembership[]>([]);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [currentRole, setCurrentRole] = useState<CompanyRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [defaultCompanyReselected, setDefaultCompanyReselected] = useState<Company | null>(null);

  const fetchCompanies = async () => {
    if (!user) {
      setCompanies([]);
      setCurrentCompany(null);
      setCurrentRole(null);
      setLoading(false);
      return;
    }

    // Ensure loading is true when starting fetch
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("company_members")
        .select(`
          company_id,
          role,
          company:companies (
            id,
            name,
            niche,
            created_by,
            subscription_plan,
            subscription_status,
            created_at
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      const memberships = (data || []).map((item) => ({
        company_id: item.company_id,
        role: item.role as CompanyRole,
        company: item.company as unknown as Company,
      }));

      setCompanies(memberships);

      // Set current company from localStorage or first company
      const storedCompanyId = localStorage.getItem("currentCompanyId");
      const storedMembership = memberships.find(m => m.company_id === storedCompanyId);
      
      if (storedMembership) {
        setCurrentCompany(storedMembership.company);
        setCurrentRole(storedMembership.role);
      } else if (memberships.length > 0) {
        setCurrentCompany(memberships[0].company);
        setCurrentRole(memberships[0].role);
        localStorage.setItem("currentCompanyId", memberships[0].company_id);
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [user]);

  const createCompany = async (name: string, niche: Niche) => {
    if (!user) {
      return { error: new Error("Not authenticated"), company: null };
    }

    try {
      // Create the company
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .insert({
          name,
          niche,
          created_by: user.id,
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // Create the owner membership
      const { error: memberError } = await supabase
        .from("company_members")
        .insert({
          company_id: companyData.id,
          user_id: user.id,
          role: "owner",
        });

      if (memberError) throw memberError;

      const company: Company = {
        id: companyData.id,
        name: companyData.name,
        niche: companyData.niche as Niche,
        created_by: companyData.created_by,
        subscription_plan: companyData.subscription_plan,
        subscription_status: companyData.subscription_status,
        created_at: companyData.created_at,
      };

      // Update local state
      const newMembership: CompanyMembership = {
        company_id: company.id,
        role: "owner",
        company,
      };

      setCompanies(prev => [...prev, newMembership]);
      setCurrentCompany(company);
      setCurrentRole("owner");
      localStorage.setItem("currentCompanyId", company.id);

      return { error: null, company };
    } catch (error) {
      console.error("Error creating company:", error);
      return { error: error as Error, company: null };
    }
  };

  const switchCompany = (companyId: string) => {
    const membership = companies.find(m => m.company_id === companyId);
    if (membership) {
      setCurrentCompany(membership.company);
      setCurrentRole(membership.role);
      localStorage.setItem("currentCompanyId", companyId);
    }
  };

  return (
    <CompanyContext.Provider value={{
      currentCompany,
      currentRole,
      companies,
      loading,
      createCompany,
      switchCompany,
      refetch: fetchCompanies,
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return context;
}
