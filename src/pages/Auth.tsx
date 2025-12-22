import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Zap, ArrowLeft, Mail, KeyRound, Loader2 } from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";

type AuthStep = "email" | "otp";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isSignup = searchParams.get("signup") === "true";
  
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsLoading(true);
    
    // Simulate OTP send - will be replaced with Supabase
    await new Promise(resolve => setTimeout(resolve, 1000));
    
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
    
    // Simulate verification - will be replaced with Supabase
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success("Welcome!", {
      description: "Redirecting to your dashboard...",
    });
    
    // For demo, redirect to onboarding
    navigate("/onboarding");
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div 
          className="w-full max-w-md"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
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
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 bg-secondary border-border"
                    required
                  />
                </div>
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
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Verification code</label>
                  <button
                    type="button"
                    onClick={() => setStep("email")}
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
                onClick={handleEmailSubmit}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
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

      {/* Right side - Visual */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute inset-0 gradient-bg opacity-20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary/20 via-transparent to-transparent rounded-full blur-3xl" />
        
        <motion.div 
          className="relative z-10 text-center max-w-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Badge variant="gradient" className="mb-6">Passwordless Login</Badge>
          <h3 className="text-4xl font-bold mb-4">
            Secure. Simple. <span className="gradient-text">Fast.</span>
          </h3>
          <p className="text-muted-foreground">
            No passwords to remember. We'll send you a secure verification code 
            every time you sign in.
          </p>
          
          <div className="mt-12 glass rounded-xl p-6 text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-semibold">Email OTP Authentication</p>
                <p className="text-sm text-muted-foreground">6-digit code sent instantly</p>
              </div>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div 
                  key={i} 
                  className="w-10 h-12 rounded-lg bg-secondary border border-border flex items-center justify-center text-xl font-mono animate-pulse"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  •
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
