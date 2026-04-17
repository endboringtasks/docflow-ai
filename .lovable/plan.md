
The user wants a portable specification/prompt for the Feedback feature so they can recreate it in other projects. I have the two main components already (`FeedbackWidget.tsx` and `FeedbackDialog.tsx`) and the `beta_feedback` table schema with RLS policies. I'll generate a comprehensive markdown prompt file and save it to `/mnt/documents/` as a downloadable artifact.

## Plan: Export Feedback Feature Prompt

Generate a self-contained markdown specification file (`feedback-feature-prompt.md`) that another AI/developer can use to rebuild this feature from scratch in any React + Supabase project.

### Contents of the Prompt
1. **Overview** — what the feature does (floating widget + dialog + admin review)
2. **Database Schema** — full SQL for `beta_feedback` table including columns, defaults, RLS policies (user can submit/view own; platform admins can view/update/delete all)
3. **Frontend Components**:
   - `FeedbackWidget.tsx` — floating bottom-right button with pulse animation for first-time users, hides on public paths, requires auth
   - `FeedbackDialog.tsx` — typed form (bug/feature/question/other) with title + description, captures `current_page` and `user_agent`
4. **Dependencies** — react-hook-form, zod, framer-motion, lucide-react, shadcn/ui (Dialog, Form, RadioGroup, Textarea, Button, Tooltip)
5. **Integration steps** — mount widget once in `App.tsx`, ensure `useAuth` hook exists, public paths config
6. **Optional extensions** — admin panel to view/triage feedback, status workflow (new → in_progress → resolved), notifications

### Deliverable
Save to `/mnt/documents/feedback-feature-prompt.md` and emit a `<lov-artifact>` tag for download.

No code changes to the project itself — purely a doc export task.
