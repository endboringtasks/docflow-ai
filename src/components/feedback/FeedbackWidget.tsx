import { useState, useEffect } from "react";
import { MessageSquarePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { FeedbackDialog } from "./FeedbackDialog";

const PUBLIC_PATHS = ["/", "/auth", "/privacy", "/terms", "/client-portal"];

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  // Check if we should show pulse animation (first visit)
  useEffect(() => {
    const hasSeenFeedbackWidget = localStorage.getItem("feedback-widget-seen");
    if (!hasSeenFeedbackWidget && user) {
      setShowPulse(true);
    }
  }, [user]);

  // Hide pulse after first interaction
  const handleClick = () => {
    if (showPulse) {
      localStorage.setItem("feedback-widget-seen", "true");
      setShowPulse(false);
    }
    setOpen(true);
  };

  // Don't render on public paths or when not authenticated
  const isPublicPath = PUBLIC_PATHS.some(path => 
    location.pathname === path || location.pathname.startsWith("/client-portal")
  );
  
  if (!user || isPublicPath) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          className="fixed bottom-6 right-6 z-50"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleClick}
                size="lg"
                className="relative h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
              >
                <MessageSquarePlus className="h-6 w-6" />
                
                {/* Pulse animation for first-time users */}
                {showPulse && (
                  <motion.span
                    className="absolute inset-0 rounded-full bg-primary"
                    initial={{ opacity: 0.5, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.5 }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      repeatType: "loop",
                    }}
                  />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Send Feedback</p>
            </TooltipContent>
          </Tooltip>
        </motion.div>
      </AnimatePresence>

      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
