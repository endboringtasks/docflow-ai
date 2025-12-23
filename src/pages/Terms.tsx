import { SEO } from "@/components/SEO";
import { Link } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Terms = () => {
  return (
    <>
      <SEO 
        title="Terms of Service"
        description="Read the terms and conditions for using Docflow AI's document workflow automation platform."
        canonical="/terms"
        noIndex={false}
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
            
            <Button variant="ghost" asChild>
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>
        </nav>

        {/* Content */}
        <main className="pt-32 pb-20">
          <div className="container mx-auto px-6 max-w-4xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-8">Terms of Service</h1>
            <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            
            <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  By accessing or using Docflow AI ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Docflow AI provides a document workflow automation platform designed for migration agents, auditors, HR professionals, and other industries that handle document-heavy workflows.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">To use certain features of the Service, you must:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Create an account with accurate and complete information</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Promptly notify us of any unauthorized access</li>
                  <li>Be responsible for all activities under your account</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. Acceptable Use</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">You agree not to:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Use the Service for any unlawful purpose</li>
                  <li>Upload malicious code or interfere with the Service</li>
                  <li>Attempt to gain unauthorized access to our systems</li>
                  <li>Resell or redistribute the Service without authorization</li>
                  <li>Violate any applicable laws or regulations</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Intellectual Property</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The Service and its original content, features, and functionality are owned by End Boring Tasks and are protected by international copyright, trademark, and other intellectual property laws.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. User Content</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You retain ownership of content you upload to the Service. By uploading content, you grant us a license to use, store, and process that content solely for providing the Service to you.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Payment Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Paid subscriptions are billed in advance on a monthly or annual basis. Fees are non-refundable except as required by law. We reserve the right to change pricing with 30 days notice.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  To the maximum extent permitted by law, End Boring Tasks shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. Termination</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may terminate or suspend your account at any time for violations of these Terms. Upon termination, your right to use the Service will immediately cease.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Changes to Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to modify these Terms at any time. We will notify you of significant changes via email or through the Service. Continued use after changes constitutes acceptance.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">11. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about these Terms, please contact us at{" "}
                  <a href="mailto:legal@endboringtasks.com" className="text-primary hover:underline">
                    legal@endboringtasks.com
                  </a>
                </p>
              </section>
            </div>
          </div>
        </main>

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
                <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
                <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                <a href="mailto:support@endboringtasks.com" className="hover:text-foreground transition-colors">Contact</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Terms;
