import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Zap, FileCheck, Users, Clipboard, ArrowRight, Check, Loader2, FolderSync, CheckCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { SEO } from "@/components/SEO";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";

type Niche = "migration" | "audit" | "hr";

interface NicheOption {
  id: Niche;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  available: boolean;
}

const niches: NicheOption[] = [
  {
    id: "migration",
    title: "Migration Services",
    subtitle: "Docflow AI – Migration",
    description: "Visa applications, client management, document validation",
    icon: FileCheck,
    available: true,
  },
  {
    id: "audit",
    title: "Audit Services",
    subtitle: "Docflow AI – Audit",
    description: "Audit engagements, document requests, review workflows",
    icon: Clipboard,
    available: false,
  },
  {
    id: "hr",
    title: "HR Services",
    subtitle: "Docflow AI – HR",
    description: "Employee management, onboarding, compliance tracking",
    icon: Users,
    available: false,
  },
];

const driveFeatures = [
  "Automatic folder creation for each client",
  "Visa application-specific subfolders",
  "Secure storage in your own Google Drive",
];

const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { currentCompany, loading: companyLoading, createCompany } = useCompany();
  
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [selectedNiche, setSelectedNiche] = useState<Niche | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(null);
  const [createdNiche, setCreatedNiche] = useState<Niche | null>(null);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);

  // Handle OAuth callback from Google Drive
  useEffect(() => {
    const driveConnected = searchParams.get("drive_connected");
    const driveError = searchParams.get("drive_error");

    if (driveConnected === "true") {
      toast.success("Google Drive connected successfully!");
      // Navigate to dashboard after successful connection
      const niche = createdNiche || "migration";
      navigate(`/app/${niche}/dashboard`);
    } else if (driveError) {
      toast.error("Failed to connect Google Drive", {
        description: driveError,
      });
    }
  }, [searchParams, navigate, createdNiche]);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Redirect to dashboard if user already has a company (and not on step 3)
  useEffect(() => {
    if (!companyLoading && currentCompany && step < 3) {
      navigate(`/app/${currentCompany.niche}/dashboard`);
    }
  }, [currentCompany, companyLoading, navigate, step]);

  const handleConnectGoogleDrive = async () => {
    if (!createdCompanyId) {
      toast.error("Company not found. Please try again.");
      return;
    }

    setIsConnectingDrive(true);

    try {
      const { data, error } = await supabase.functions.invoke("google-drive-auth", {
        body: {
          companyId: createdCompanyId,
          origin: window.location.origin,
          fromOnboarding: true,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error("No authorization URL received");
      }
    } catch (error) {
      console.error("Failed to initiate Google Drive connection:", error);
      toast.error("Failed to connect Google Drive", {
        description: error instanceof Error ? error.message : "Please try again",
      });
      setIsConnectingDrive(false);
    }
  };

  const handleSkipDrive = () => {
    const niche = createdNiche || "migration";
    navigate(`/app/${niche}/dashboard`);
  };

  const handleContinue = async () => {
    if (step === 1 && companyName.trim()) {
      setStep(2);
    } else if (step === 2 && selectedNiche) {
      setIsLoading(true);
      
      const { error, company } = await createCompany(companyName.trim(), selectedNiche);
      
      if (error) {
        toast.error("Failed to create workspace", {
          description: error.message,
        });
        setIsLoading(false);
        return;
      }
      
      toast.success("Company created successfully!", {
        description: `Welcome to Docflow AI – ${selectedNiche.charAt(0).toUpperCase() + selectedNiche.slice(1)}`,
      });
      
      // Store company info and move to step 3
      setCreatedCompanyId(company?.id || null);
      setCreatedNiche(selectedNiche);
      setIsLoading(false);
      setStep(3);
    }
  };

  // Show loading while checking auth/company state
  if (authLoading || companyLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render if user already has a company and not on step 3 (will redirect)
  if (currentCompany && step < 3) {
    return null;
  }

  const getStepLabel = (s: number) => {
    switch (s) {
      case 1:
        return "Company";
      case 2:
        return "Industry";
      case 3:
        return "Integrations";
      default:
        return "";
    }
  };

  return (
    <>
      <SEO 
        title="Set Up Your Workspace"
        description="Set up your Docflow AI workspace. Choose your industry and configure your document automation platform."
        canonical="/onboarding"
        noIndex
      />
      <div className="min-h-screen bg-background flex items-center justify-center p-8 relative">
        {/* Theme Toggle */}
        <div className="absolute top-4 right-4 z-20">
          <ThemeToggle />
        </div>
        
        <div className="absolute inset-0 bg-hero-gradient opacity-30" />
      
      <motion.div 
        className="relative z-10 w-full max-w-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-14 h-14 gradient-bg rounded-2xl flex items-center justify-center">
              <Zap className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Set up your workspace</h1>
          <p className="text-muted-foreground">Let's get your company configured in just a few steps</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-4 mb-12">
          {[1, 2, 3].map((s, index) => (
            <div key={s} className="flex items-center gap-2">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  s < step ? "gradient-bg text-primary-foreground" : 
                  s === step ? "border-2 border-primary text-primary" : 
                  "border border-border text-muted-foreground"
                }`}
              >
                {s < step ? <Check className="w-4 h-4" /> : s}
              </div>
              <span className={`text-sm ${s === step ? "text-foreground" : "text-muted-foreground"}`}>
                {getStepLabel(s)}
              </span>
              {index < 2 && <div className="w-12 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Form Content */}
        <div className="glass rounded-2xl p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-bold mb-2">What's your company name?</h2>
                <p className="text-muted-foreground mb-8">
                  This will be your workspace name in Docflow AI
                </p>
                
                <div className="space-y-2 mb-8">
                  <label className="text-sm font-medium">Company name</label>
                  <Input
                    type="text"
                    placeholder="Acme Corp"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="h-12 bg-secondary border-border"
                    autoFocus
                  />
                </div>
                
                <Button 
                  variant="gradient" 
                  className="w-full h-12"
                  onClick={handleContinue}
                  disabled={!companyName.trim()}
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-bold mb-2">Select your industry</h2>
                <p className="text-muted-foreground mb-8">
                  Choose the solution that best fits <span className="text-foreground font-medium">{companyName}</span>
                </p>
                
                <div className="grid gap-4 mb-8">
                  {niches.map((niche) => (
                    <button
                      key={niche.id}
                      onClick={() => niche.available && setSelectedNiche(niche.id)}
                      disabled={!niche.available}
                      className={`relative w-full text-left p-6 rounded-xl border transition-all ${
                        selectedNiche === niche.id
                          ? "border-primary bg-primary/10 shadow-glow"
                          : niche.available
                          ? "border-border bg-secondary/50 hover:border-primary/50"
                          : "border-border bg-secondary/30 opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          selectedNiche === niche.id ? "gradient-bg" : "bg-secondary"
                        }`}>
                          <niche.icon className={`w-6 h-6 ${
                            selectedNiche === niche.id ? "text-primary-foreground" : "text-muted-foreground"
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{niche.title}</h3>
                            {!niche.available && (
                              <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                            )}
                          </div>
                          <p className="text-sm text-primary mb-1">{niche.subtitle}</p>
                          <p className="text-sm text-muted-foreground">{niche.description}</p>
                        </div>
                        {selectedNiche === niche.id && (
                          <div className="w-6 h-6 rounded-full gradient-bg flex items-center justify-center">
                            <Check className="w-4 h-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                
                <div className="flex gap-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-12"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button 
                    variant="gradient" 
                    className="flex-1 h-12"
                    onClick={handleContinue}
                    disabled={!selectedNiche || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating workspace...
                      </>
                    ) : (
                      <>
                        Create Workspace
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <FolderSync className="w-8 h-8 text-primary" />
                  </div>
                </div>
                
                <h2 className="text-2xl font-bold mb-2">Connect Google Drive</h2>
                <p className="text-muted-foreground mb-8">
                  Organize your client documents automatically
                </p>
                
                <div className="bg-secondary/50 rounded-xl p-6 mb-8 text-left">
                  <p className="text-sm font-medium mb-4">What this enables:</p>
                  <ul className="space-y-3">
                    {driveFeatures.map((feature, index) => (
                      <li key={index} className="flex items-center gap-3 text-sm text-muted-foreground">
                        <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <Button 
                  variant="gradient" 
                  className="w-full h-12 mb-4"
                  onClick={handleConnectGoogleDrive}
                  disabled={isConnectingDrive}
                >
                  {isConnectingDrive ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <FolderSync className="w-4 h-4" />
                      Connect Google Drive
                    </>
                  )}
                </Button>
                
                <button
                  onClick={handleSkipDrive}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isConnectingDrive}
                >
                  Skip for now →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
    </>
  );
};

export default Onboarding;
