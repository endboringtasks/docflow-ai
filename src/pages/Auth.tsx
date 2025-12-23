import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, ArrowLeft, Mail, KeyRound, Loader2 } from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { PendingInvitations } from "@/components/auth/PendingInvitations";
import { z } from "zod";

type AuthStep = "email" | "otp";

const emailSchema = z.string().email("Please enter a valid email address");

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentCompany, loading: companyLoading } = useCompany();
  const { signInWithOtp, verifyOtp } = useAuth();
  const isSignup = searchParams.get("signup") === "true";
  
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  // Redirect based on authentication and company status
  useEffect(() => {
    if (!authLoading && !companyLoading && user) {
      if (currentCompany) {
        // Existing user with company → go to dashboard
        navigate(`/app/${currentCompany.niche}/dashboard`);
      } else {
        // New user without company → go to onboarding
        navigate("/onboarding");
      }
    }
  }, [user, authLoading, currentCompany, companyLoading, navigate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    
    // Validate email
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setEmailError(result.error.errors[0].message);
      return;
    }
    
    setIsLoading(true);
    
    const { error } = await signInWithOtp(email);
    
    if (error) {
      console.error("OTP send error:", error.message);
      toast.error("Failed to send verification code", {
        description: error.message,
      });
      setIsLoading(false);
      return;
    }
    
    toast.success("Verification code sent!", {
      description: `Check your email at ${email}`,
    });
    
    setStep("otp");
    setIsLoading(false);
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) return;
    
    setIsLoading(true);
    
    const { error } = await verifyOtp(email, otp);
    
    if (error) {
      console.error("OTP verification error:", error.message);
      toast.error("Invalid verification code", {
        description: "Please check the code and try again.",
      });
      setIsLoading(false);
      return;
    }
    
    toast.success("Welcome!", {
      description: "Redirecting...",
    });
    
    // Navigation will be handled by the useEffect watching user state
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    
    const { error } = await signInWithOtp(email);
    
    if (error) {
      toast.error("Failed to resend code", {
        description: error.message,
      });
    } else {
      toast.success("New code sent!", {
        description: `Check your email at ${email}`,
      });
    }
    
    setIsLoading(false);
  };

  if (authLoading || companyLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <motion.div 
        className="w-full max-w-md"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
        
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 gradient-bg rounded-xl flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">End Boring Tasks</h1>
            <p className="text-sm text-muted-foreground">Powered by Docflow AI</p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            {isSignup ? "Create your account" : "Welcome back"}
          </h2>
          <p className="text-muted-foreground">
            {step === "email" 
              ? "Enter your email to receive a verification code" 
              : "Enter the 6-digit code we sent to your email"
            }
          </p>
        </div>

        {step === "email" ? (
          <div className="space-y-6">
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError("");
                    }}
                    className={`pl-10 h-12 bg-secondary border-border ${emailError ? "border-destructive" : ""}`}
                    required
                  />
                </div>
                {emailError && (
                  <p className="text-sm text-destructive">{emailError}</p>
                )}
              </div>
              
              <Button 
                type="submit" 
                variant="gradient" 
                className="w-full h-12"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending code...
                  </>
                ) : (
                  "Continue with Email"
                )}
              </Button>
            </form>

            {/* Show pending invitations on the auth page */}
            <PendingInvitations />
          </div>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Verification code</label>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Change email
                </button>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="pl-10 h-12 bg-secondary border-border text-center text-2xl tracking-[0.5em] font-mono"
                  maxLength={6}
                  autoFocus
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Sent to <span className="text-foreground">{email}</span>
              </p>
            </div>
            
            <Button 
              type="submit" 
              variant="gradient" 
              className="w-full h-12"
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Continue"
              )}
            </Button>

            <button
              type="button"
              onClick={handleResendCode}
              disabled={isLoading}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Didn't receive a code? Resend
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {isSignup ? "Already have an account? " : "Don't have an account? "}
          <Link 
            to={isSignup ? "/auth" : "/auth?signup=true"} 
            className="text-primary hover:underline"
          >
            {isSignup ? "Sign in" : "Create one"}
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
