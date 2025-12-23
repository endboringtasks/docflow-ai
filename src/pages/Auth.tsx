import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, ArrowLeft, Mail, KeyRound, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Link, useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { PendingInvitations } from "@/components/auth/PendingInvitations";
import { SEO } from "@/components/SEO";
import { z } from "zod";

type AuthStep = "email" | "otp" | "expired";

const emailSchema = z.string().email("Please enter a valid email address");

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { currentCompany, loading: companyLoading } = useCompany();
  const { signInWithOtp, verifyOtp, signInWithGoogle } = useAuth();
  const isSignup = searchParams.get("signup") === "true";
  
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [expiredEmail, setExpiredEmail] = useState("");

  // Redirect based on authentication and company status
  useEffect(() => {
    if (!authLoading && !companyLoading && user) {
      if (currentCompany) {
        navigate(`/app/${currentCompany.niche}/dashboard`);
      } else {
        navigate("/onboarding");
      }
    }
  }, [user, authLoading, currentCompany, companyLoading, navigate]);

  // Handle magic-link errors in URL fragment (e.g. #error_code=otp_expired)
  useEffect(() => {
    if (!location.hash) return;

    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
    const errorCode = hashParams.get("error_code");

    if (!errorCode) return;

    // Clear fragment so the error doesn't repeat on refresh/back
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );

    if (errorCode === "otp_expired") {
      // Show the dedicated expired screen
      setStep("expired");
      setOtp("");
    } else {
      const errorDescription = hashParams.get("error_description");
      toast.error("Authentication error", {
        description: errorDescription || errorCode,
      });
      setStep("email");
      setOtp("");
    }
  }, [location.hash]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    
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
    
    const emailToVerify = step === "expired" ? expiredEmail : email;
    const { error } = await verifyOtp(emailToVerify, otp);
    
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
  };

  const handleResendCode = async (targetEmail?: string) => {
    const emailToUse = targetEmail || email;
    if (!emailToUse) {
      toast.error("Please enter your email first");
      return;
    }
    
    setIsLoading(true);
    
    const { error } = await signInWithOtp(emailToUse);
    
    if (error) {
      toast.error("Failed to resend code", {
        description: error.message,
      });
    } else {
      toast.success("New code sent!", {
        description: `Check your email at ${emailToUse}`,
      });
      // Move to OTP step after resending
      if (step === "expired") {
        setEmail(emailToUse);
        setStep("otp");
      }
    }
    
    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();
    
    if (error) {
      console.error("Google sign-in error:", error.message);
      toast.error("Failed to sign in with Google", {
        description: error.message,
      });
      setIsGoogleLoading(false);
    }
    // Don't set loading to false on success - redirect will happen
  };

  const handleExpiredEnterCode = () => {
    if (expiredEmail) {
      setEmail(expiredEmail);
    }
    setStep("otp");
  };

  if (authLoading || companyLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SEO 
        title={isSignup ? "Create Account" : "Sign In"}
        description="Sign in or create an account for Docflow AI. Automate your document workflows with secure authentication."
        canonical="/auth"
        noIndex
      />
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
            <h1 className="text-2xl font-bold">Docflow AI</h1>
            <p className="text-sm text-muted-foreground">Powered by End Boring Tasks</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === "expired" ? (
            <motion.div
              key="expired"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Expired Link Screen */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Email Link Expired</h2>
                <p className="text-muted-foreground">
                  The sign-in link you clicked is no longer valid. This often happens when email security scanners pre-open links.
                </p>
              </div>

              <div className="bg-secondary/50 rounded-lg p-4 border border-border">
                <p className="text-sm text-muted-foreground mb-3">
                  <strong className="text-foreground">Good news:</strong> The 6-digit code in your email still works! Enter it below to continue.
                </p>
                
                <form onSubmit={handleOtpSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Your email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="you@company.com"
                        value={expiredEmail}
                        onChange={(e) => setExpiredEmail(e.target.value)}
                        className="pl-10 h-12 bg-background border-border"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">6-digit code from email</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="000000"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="pl-10 h-12 bg-background border-border text-center text-2xl tracking-[0.5em] font-mono"
                        maxLength={6}
                        autoFocus
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    variant="gradient" 
                    className="w-full h-12"
                    disabled={isLoading || otp.length !== 6 || !expiredEmail}
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
                </form>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full h-12"
                  onClick={() => handleResendCode(expiredEmail)}
                  disabled={isLoading || !expiredEmail}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                  Send a New Code
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                    setExpiredEmail("");
                  }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Use a different email
                </button>
              </div>
            </motion.div>
          ) : step === "email" ? (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2">
                  {isSignup ? "Create your account" : "Welcome back"}
                </h2>
                <p className="text-muted-foreground">
                  Enter your email to receive a 6-digit verification code
                </p>
              </div>

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
                  disabled={isLoading || isGoogleLoading}
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

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12"
                onClick={handleGoogleSignIn}
                disabled={isLoading || isGoogleLoading}
              >
                {isGoogleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>

              <PendingInvitations />
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2">
                  {isSignup ? "Create your account" : "Welcome back"}
                </h2>
                <p className="text-muted-foreground">
                  Enter the 6-digit code from the email (this works even if the email link says expired)
                </p>
              </div>

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
                  <p className="text-xs text-muted-foreground">
                    If clicking the email button shows "expired", just enter the 6-digit code above.
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
                  onClick={() => handleResendCode()}
                  disabled={isLoading}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Didn't receive a code? Resend
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

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
    </>
  );
};

export default Auth;
