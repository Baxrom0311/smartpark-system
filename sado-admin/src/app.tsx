import { Activity, ShieldCheck, Sparkles } from "lucide-react";

/**
 * Top-level admin shell. Will be replaced by TanStack Router routes
 * in a later milestone (M5+). For now this is a static landing page
 * that proves the build pipeline works end-to-end.
 */
export function App(): React.ReactElement {
  return (
    <main className="flex min-h-full items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl rounded-2xl border border-brand-200 bg-white/70 p-10 shadow-xl backdrop-blur dark:border-brand-800 dark:bg-brand-900/40">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white shadow-md">
            <Sparkles className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-brand-900 dark:text-brand-100">
              SADO Admin
            </h1>
            <p className="text-sm text-brand-600 dark:text-brand-300">
              AI-powered speech therapy platform — administration console
            </p>
          </div>
        </div>

        <hr className="my-8 border-brand-200 dark:border-brand-700" />

        <ul className="grid gap-4 sm:grid-cols-2">
          <li className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-900/60">
            <Activity className="mt-0.5 h-5 w-5 text-brand-600" aria-hidden />
            <div>
              <p className="font-semibold">Real-time analytics</p>
              <p className="text-sm text-brand-700 dark:text-brand-300">
                Risk distribution, regional heatmaps, exercise completion.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-900/60">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-brand-600" aria-hidden />
            <div>
              <p className="font-semibold">Role-based access</p>
              <p className="text-sm text-brand-700 dark:text-brand-300">
                Parents, teachers, therapists, and admins — each with the right
                view.
              </p>
            </div>
          </li>
        </ul>

        <p className="mt-8 text-xs uppercase tracking-wider text-brand-500">
          Build status: scaffolding complete · routing &amp; auth coming next
        </p>
      </div>
    </main>
  );
}
