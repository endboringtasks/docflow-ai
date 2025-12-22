import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Clipboard, Clock } from "lucide-react";
import { motion } from "framer-motion";

const AuditDashboard = () => {
  return (
    <AppLayout niche="audit">
      <div className="p-6 lg:p-8">
        <motion.div 
          className="max-w-2xl mx-auto text-center py-24"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-8">
            <Clipboard className="w-10 h-10 text-primary-foreground" />
          </div>
          
          <Badge variant="secondary" className="mb-4">
            <Clock className="w-3 h-3 mr-1" />
            Coming Soon
          </Badge>
          
          <h1 className="text-4xl font-bold mb-4">
            Docflow AI – <span className="gradient-text">Audit</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8">
            Streamline your audit engagements with automated document requests, 
            review workflows, and real-time status tracking.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            <div className="glass rounded-xl p-6 text-left">
              <h3 className="font-semibold mb-2">Audit Clients</h3>
              <p className="text-sm text-muted-foreground">
                Manage client relationships and engagement history
              </p>
            </div>
            <div className="glass rounded-xl p-6 text-left">
              <h3 className="font-semibold mb-2">Engagements</h3>
              <p className="text-sm text-muted-foreground">
                Track audit engagements and document requests
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default AuditDashboard;
