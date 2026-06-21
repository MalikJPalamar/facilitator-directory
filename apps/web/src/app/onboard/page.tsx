import { redirect } from "next/navigation";

import { getAuthContext } from "../../lib/auth-session.ts";
import { createSchool } from "./actions.ts";

/**
 * First-run onboarding for a signed-in user who has no school yet. Owners land
 * here straight after sign-up; once they create a school they get an owner
 * membership and are routed on to /admin.
 */
export default async function OnboardPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.organizationId) redirect("/dashboard");

  return (
    <main className="page stack">
      <header className="page-bar">
        <h1>Create your school</h1>
      </header>

      <section className="panel panel--accent stack">
        <p className="muted">
          Name your school to set up its directory. You can change branding and
          add graduates later.
        </p>

        <form action={createSchool} className="stack">
          <label className="stack" htmlFor="school-name">
            <span>School name</span>
            <input
              id="school-name"
              name="name"
              type="text"
              required
              autoFocus
              maxLength={120}
              placeholder="e.g. Northstar Academy"
            />
          </label>

          <button className="btn btn-primary" type="submit">
            Create school
          </button>
        </form>
      </section>
    </main>
  );
}
