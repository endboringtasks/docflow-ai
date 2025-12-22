import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  CheckCircle, 
  Zap,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const plans = [
  { 
    name: "Free", 
    price: "$0", 
    period: "/month", 
    credits: "0 AI Credits",
    current: false,
    features: ["Up to 5 clients", "Basic dashboard", "Email support"]
  },
  { 
    name: "Basic", 
    price: "$25", 
    period: "/month", 
    credits: "50 AI Credits",
    current: false,
    features: ["Unlimited clients", "Full dashboard", "Priority support", "Automation webhooks"]
  },
  { 
    name: "Pro", 
    price: "$49", 
    period: "/month", 
    credits: "200 AI Credits",
    current: true,
    features: ["Everything in Basic", "Advanced analytics", "Custom integrations", "Dedicated support"]
  },
  { 
    name: "Enterprise", 
    price: "Custom", 
    period: "",
    credits: "Unlimited AI Credits",
    current: false,
    features: ["Everything in Pro", "Custom workflows", "SLA guarantee", "On-premise option"]
  },
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
                <p className="text-muted-foreground">$49/month • Renews on March 15, 2024</p>
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
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                className={`rounded-xl p-6 border transition-all ${
                  plan.current 
                    ? "gradient-bg border-transparent" 
                    : "card-gradient border-border/50 hover:border-primary/50"
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
              >
                {plan.current && (
                  <Badge className="mb-4 bg-background/20 text-primary-foreground border-0">
                    Current Plan
                  </Badge>
                )}
                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                <div className="mb-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className={plan.current ? "text-primary-foreground/80" : "text-muted-foreground"}>
                    {plan.period}
                  </span>
                </div>
                <p className={`text-sm mb-4 ${plan.current ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {plan.credits}
                </p>
                
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature) => (
                    <li 
                      key={feature} 
                      className={`flex items-center gap-2 text-sm ${
                        plan.current ? "text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <CheckCircle className={`w-4 h-4 ${plan.current ? "text-primary-foreground" : "text-success"}`} />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                {!plan.current && (
                  <Button 
                    variant={plan.name === "Enterprise" ? "outline" : "secondary"}
                    className="w-full"
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
