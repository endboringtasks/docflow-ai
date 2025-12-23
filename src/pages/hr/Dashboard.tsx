import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Users, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { SEO } from "@/components/SEO";

const HRDashboard = () => {
  return (
    <>
      <SEO 
        title="HR Dashboard"
        description="Simplify employee lifecycle management with Docflow AI. Automated onboarding, offboarding, and compliance documentation."
        noIndex
      />
      <AppLayout niche="hr">
      <div className="p-6 lg:p-8">
        <motion.div 
          className="max-w-2xl mx-auto text-center py-24"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-8">
            <Users className="w-10 h-10 text-primary-foreground" />
          </div>
          
          <Badge variant="secondary" className="mb-4">
            <Clock className="w-3 h-3 mr-1" />
            Coming Soon
          </Badge>
          
          <h1 className="text-4xl font-bold mb-4">
            Docflow AI – <span className="gradient-text">HR</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8">
            Simplify employee lifecycle management with automated onboarding, 
            offboarding, and compliance documentation.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            <div className="glass rounded-xl p-6 text-left">
              <h3 className="font-semibold mb-2">Employees</h3>
              <p className="text-sm text-muted-foreground">
                Manage employee records and documentation
              </p>
            </div>
            <div className="glass rounded-xl p-6 text-left">
              <h3 className="font-semibold mb-2">HR Cases</h3>
              <p className="text-sm text-muted-foreground">
                Track onboarding, offboarding, and compliance
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AppLayout>
    </>
  );
};

export default HRDashboard;
