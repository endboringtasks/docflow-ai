import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  CheckCircle, 
  Zap,
  ArrowRight,
  Sparkles,
  Users
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const plans = [
  { 
    name: "Free", 
    price: "A$0", 
    period: "/month", 
    credits: "0 AI Credits",
    description: "Preview Access",
    current: false,
    features: ["Up to 3 clients", "Up to 5 active applications", "Basic dashboard", "Client portal access", "Multi-language support", "Email support"]
  },
  { 
    name: "Basic", 
    price: "A$39", 
    period: "/month", 
    credits: "50 AI Credits",
    description: "For Independents & Small Agencies",
    current: false,
    features: ["Up to 50 active applications", "Up to 3 team members", "Google Drive integration", "Document checklists", "Client portal", "Webhook automations", "Priority email support"]
  },
  { 
    name: "Pro", 
    price: "A$79", 
    period: "/month", 
    credits: "200 AI Credits",
    description: "For Growing Teams",
    current: true,
    features: ["Unlimited applications", "Up to 3 team members included", "Add up to 10 team members (add-ons)", "Everything in Basic", "Advanced analytics", "Audit logs", "Custom branding", "Priority support"]
  },
  { 
    name: "Teams", 
    price: "A$129", 
    period: "/month", 
    credits: "500 AI Credits",
    description: "For Structured Agencies",
    current: false,
    features: ["Everything in Pro", "Up to 25 team members", "Advanced roles & permissions", "Team-level reporting", "Activity & action logs"]
  },
  { 
    name: "Enterprise", 
    price: "Custom", 
    period: "",
    credits: "Unlimited AI Credits",
    description: "Custom Solution",
    current: false,
    features: ["Everything in Teams", "Custom AI limits", "Unlimited team members", "Custom workflows", "API access", "SLA guarantee", "Dedicated account manager"]
  },
];

const aiCreditPackages = [
  { credits: 50, price: 15 },
  { credits: 100, price: 25 },
  { credits: 500, price: 99 },
];

const Billing = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async (planName: string) => {
    setIsLoading(true);
    // Simulate Stripe checkout redirect
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.info("Stripe integration required", {
      description: "Connect Stripe to enable billing functionality.",
    });
    setIsLoading(false);
  };

  return (
    <AppLayout niche="migration">
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          <p className="text-muted-foreground">Manage your subscription and payment methods</p>
        </div>

        {/* Current Plan */}
        <motion.div 
          className="card-gradient rounded-xl border border-border/50 p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl gradient-bg flex items-center justify-center">
                <Zap className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold">Pro Plan</h2>
                  <Badge variant="gradient">Current</Badge>
                </div>
                <p className="text-muted-foreground">A$79/month • Renews on March 15, 2024</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline">Manage Payment</Button>
              <Button variant="destructive" className="bg-destructive/20 text-destructive hover:bg-destructive/30 border-0">
                Cancel Subscription
              </Button>
            </div>
          </div>
        </motion.div>

        {/* AI Credits */}
        <motion.div 
          className="glass rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold">AI Credits</h3>
              <p className="text-sm text-muted-foreground">Monthly allocation for AI-powered features</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">142 / 200 credits remaining</span>
              <span className="font-medium">71%</span>
            </div>
            <div className="h-3 rounded-full bg-secondary overflow-hidden">
              <div 
                className="h-full rounded-full gradient-bg"
                style={{ width: "71%" }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Credits reset on March 15, 2024</p>
          </div>
        </motion.div>

        {/* Available Plans */}
        <div>
          <h2 className="text-xl font-bold mb-6">Available Plans</h2>
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                className={`rounded-xl p-5 border transition-all ${
                  plan.current 
                    ? "gradient-bg border-transparent" 
                    : "card-gradient border-border/50 hover:border-primary/50"
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
              >
                {plan.current && (
                  <Badge className="mb-3 bg-background/20 text-primary-foreground border-0">
                    Current Plan
                  </Badge>
                )}
                <h3 className="text-lg font-bold mb-0.5">{plan.name}</h3>
                <p className={`text-xs mb-2 ${plan.current ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {plan.description}
                </p>
                <div className="mb-2">
                  <span className="text-2xl font-bold">{plan.price}</span>
                  <span className={`text-sm ${plan.current ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {plan.period}
                  </span>
                </div>
                <p className={`text-xs mb-3 ${plan.current ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {plan.credits}
                </p>
                
                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((feature) => (
                    <li 
                      key={feature} 
                      className={`flex items-start gap-2 text-xs ${
                        plan.current ? "text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <CheckCircle className={`w-3 h-3 mt-0.5 flex-shrink-0 ${plan.current ? "text-primary-foreground" : "text-success"}`} />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                {!plan.current && (
                  <Button 
                    variant={plan.name === "Enterprise" ? "outline" : "secondary"}
                    className="w-full"
                    size="sm"
                    onClick={() => handleUpgrade(plan.name)}
                    disabled={isLoading}
                  >
                    {plan.name === "Enterprise" ? "Contact Sales" : "Upgrade"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Add-ons Section */}
        <motion.div 
          className="space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-xl font-bold">Optional Add-ons</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Extra Team Members Card */}
            <div className="card-gradient rounded-xl border border-border/50 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold">Extra Team Members</h3>
              </div>
              <p className="text-2xl font-bold mb-2">A$7 <span className="text-sm font-normal text-muted-foreground">per user / month</span></p>
              <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                <li>• Available on Basic and Pro plans</li>
                <li>• Pro plan capped at 10 total users</li>
              </ul>
              <Button variant="outline" className="w-full" onClick={() => toast.info("Stripe integration required")}>
                Add Team Member
              </Button>
            </div>

            {/* AI Credits Packages */}
            <div className="card-gradient rounded-xl border border-border/50 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-semibold">Extra AI Credits</h3>
              </div>
              <div className="space-y-3 mb-4">
                {aiCreditPackages.map((pkg) => (
                  <div key={pkg.credits} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <span className="font-medium">+{pkg.credits} Credits</span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold">A${pkg.price}</span>
                      <Button size="sm" variant="secondary" onClick={() => toast.info("Stripe integration required")}>
                        Buy
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">Recurring or one-off purchases</p>
            </div>
          </div>

          {/* AI Credits Explanation */}
          <div className="glass rounded-xl p-6">
            <h4 className="font-semibold mb-3">What are AI Credits?</h4>
            <p className="text-sm text-muted-foreground mb-4">
              AI Credits power document intelligence tasks including:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
              <span>• Document classification</span>
              <span>• Data extraction</span>
              <span>• Validation checks</span>
              <span>• Expiry detection</span>
              <span>• Form comparison</span>
            </div>
            <p className="text-sm mt-4 font-medium">1 AI Credit = 1 document analysis. You only pay for AI when you use it.</p>
          </div>
        </motion.div>

        {/* Payment History */}
        <motion.div 
          className="card-gradient rounded-xl border border-border/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="p-6 border-b border-border/50">
            <h2 className="text-xl font-bold">Payment History</h2>
          </div>
          <div className="divide-y divide-border/50">
            {[
              { date: "Feb 15, 2024", amount: "$49.00", status: "Paid", invoice: "INV-2024-002" },
              { date: "Jan 15, 2024", amount: "$49.00", status: "Paid", invoice: "INV-2024-001" },
              { date: "Dec 15, 2023", amount: "$25.00", status: "Paid", invoice: "INV-2023-012" },
            ].map((payment) => (
              <div key={payment.invoice} className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{payment.amount}</p>
                    <p className="text-sm text-muted-foreground">{payment.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="success">{payment.status}</Badge>
                  <Button variant="ghost" size="sm">
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default Billing;
