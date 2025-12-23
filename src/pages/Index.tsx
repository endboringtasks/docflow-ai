import { Zap, FileCheck, Users, ArrowRight, CheckCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { SEO } from "@/components/SEO";

const homepageJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Docflow AI",
    "alternateName": "End Boring Tasks",
    "url": "https://docflow.ai",
    "logo": "https://docflow.ai/logo.png",
    "description": "Docflow AI automates document-heavy workflows across industries.",
    "sameAs": []
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Docflow AI",
    "url": "https://docflow.ai",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://docflow.ai/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Docflow AI",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "description": "Automate document-heavy workflows across industries. Structure, validate, and track — all in one powerful platform.",
    "offers": [
      {
        "@type": "Offer",
        "name": "Free",
        "price": "0",
        "priceCurrency": "USD"
      },
      {
        "@type": "Offer",
        "name": "Basic",
        "price": "25",
        "priceCurrency": "USD",
        "priceValidUntil": "2025-12-31"
      },
      {
        "@type": "Offer",
        "name": "Pro",
        "price": "49",
        "priceCurrency": "USD",
        "priceValidUntil": "2025-12-31"
      }
    ],
    "featureList": [
      "Document Structure Automation",
      "Real-time Validation Engine",
      "Workflow Automation",
      "Client Portal",
      "Migration Services",
      "Audit Services",
      "HR Services"
    ]
  }
];

const Index = () => {
  return (
    <>
      <SEO 
        canonical="/"
        description="Docflow AI automates document-heavy workflows across industries. Structure, validate, and track — all in one powerful platform. Start your free trial today."
        jsonLd={homepageJsonLd}
      />
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Docflow AI</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#solutions" className="text-muted-foreground hover:text-foreground transition-colors">Solutions</a>
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button variant="gradient" asChild>
              <Link to="/auth?signup=true">Start Free</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-hero-gradient opacity-50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/10 via-transparent to-transparent rounded-full blur-3xl" />
        
        <div className="container mx-auto px-6 relative">
          <motion.div 
            className="text-center max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="gradient" className="mb-6">
              <Sparkles className="w-3 h-3 mr-1" />
              Powered by End Boring Tasks
            </Badge>
            
            <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
              End Boring Tasks.
              <br />
              <span className="gradient-text">Automate Everything.</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Docflow AI automates document-heavy workflows across industries. 
              Structure, validate, and track — all in one powerful platform.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="gradient" size="xl" asChild>
                <Link to="/auth?signup=true">
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button variant="outline" size="xl">
                Watch Demo
              </Button>
            </div>
            
            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                14-day free trial
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                Cancel anytime
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Solutions Section */}
      <section id="solutions" className="py-24 relative">
        <div className="container mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-4">Solutions by Industry</Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              One Engine. <span className="gradient-text">Many Industries.</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Docflow AI adapts to your industry's specific terminology and workflows.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Migration Services",
                subtitle: "Docflow AI – Migration",
                description: "Automate visa application workflows, document collection, and compliance tracking.",
                icon: FileCheck,
                status: "Available",
                features: ["Client Management", "Visa Applications", "Document Validation", "Status Tracking"]
              },
              {
                title: "Audit Services",
                subtitle: "Docflow AI – Audit",
                description: "Streamline audit engagements with automated document requests and review workflows.",
                icon: FileCheck,
                status: "Coming Soon",
                features: ["Audit Clients", "Engagement Tracking", "Document Requests", "Review Workflows"]
              },
              {
                title: "HR Services",
                subtitle: "Docflow AI – HR",
                description: "Simplify employee onboarding, offboarding, and compliance documentation.",
                icon: Users,
                status: "Coming Soon",
                features: ["Employee Management", "Onboarding Cases", "Compliance Tracking", "Document Collection"]
              }
            ].map((solution, index) => (
              <motion.div
                key={solution.title}
                className="card-gradient rounded-2xl p-8 border border-border/50 shadow-card hover:shadow-elevated transition-all duration-300 group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="w-14 h-14 rounded-xl gradient-bg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <solution.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <Badge variant={solution.status === "Available" ? "success" : "secondary"}>
                    {solution.status}
                  </Badge>
                </div>
                
                <h3 className="text-2xl font-bold mb-2">{solution.title}</h3>
                <p className="text-sm text-primary mb-3">{solution.subtitle}</p>
                <p className="text-muted-foreground mb-6">{solution.description}</p>
                
                <ul className="space-y-2">
                  {solution.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative bg-secondary/30">
        <div className="container mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-4">Core Features</Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Powerful <span className="gradient-text">Automation</span> Tools
            </h2>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: FileCheck, title: "Document Structure", description: "Automatically organize and categorize documents for each case" },
              { icon: CheckCircle, title: "Validation Engine", description: "Real-time validation of document requirements and completeness" },
              { icon: Zap, title: "Workflow Automation", description: "Trigger actions and notifications based on case status" },
              { icon: Users, title: "Client Portal", description: "Secure access for clients to submit and track documents" },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                className="glass rounded-xl p-6 text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="w-12 h-12 rounded-lg gradient-bg flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24">
        <div className="container mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-4">Simple Pricing</Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Choose Your <span className="gradient-text">Plan</span>
            </h2>
            <p className="text-muted-foreground text-lg">Per company. All team members included.</p>
          </motion.div>
          
          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              { name: "Free", price: "$0", period: "/month", credits: "0 AI Credits", features: ["Up to 5 clients", "Basic dashboard", "Email support"], cta: "Start Free", popular: false },
              { name: "Basic", price: "$25", period: "/month", credits: "50 AI Credits", features: ["Unlimited clients", "Full dashboard", "Priority support", "Automation webhooks"], cta: "Get Started", popular: false },
              { name: "Pro", price: "$49", period: "/month", credits: "200 AI Credits", features: ["Everything in Basic", "Advanced analytics", "Custom integrations", "Dedicated support"], cta: "Get Started", popular: true },
              { name: "Enterprise", price: "Custom", period: "", credits: "Unlimited AI Credits", features: ["Everything in Pro", "Custom workflows", "SLA guarantee", "On-premise option"], cta: "Contact Sales", popular: false },
            ].map((plan, index) => (
              <motion.div
                key={plan.name}
                className={`rounded-2xl p-8 border transition-all duration-300 ${
                  plan.popular 
                    ? "gradient-bg border-transparent shadow-glow scale-105" 
                    : "card-gradient border-border/50 hover:border-primary/50"
                }`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                {plan.popular && (
                  <Badge className="mb-4 bg-background/20 text-primary-foreground border-0">Most Popular</Badge>
                )}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <p className={`text-sm mb-6 ${plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {plan.credits}
                </p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className={`flex items-center gap-2 text-sm ${plan.popular ? "text-primary-foreground" : "text-muted-foreground"}`}>
                      <CheckCircle className={`w-4 h-4 ${plan.popular ? "text-primary-foreground" : "text-success"}`} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button 
                  variant={plan.popular ? "secondary" : "outline"} 
                  className="w-full"
                  asChild
                >
                  <Link to="/auth?signup=true">{plan.cta}</Link>
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 gradient-bg opacity-10" />
        <div className="container mx-auto px-6 relative">
          <motion.div 
            className="text-center max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to <span className="gradient-text">End Boring Tasks?</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-10">
              Join hundreds of businesses automating their document workflows with Docflow AI.
            </p>
            <Button variant="gradient" size="xl" asChild>
              <Link to="/auth?signup=true">
                Get Started Now
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 gradient-bg rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">Docflow AI</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Docflow AI by End Boring Tasks. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
};

export default Index;
