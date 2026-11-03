import GoogleSignInButton from "@/components/GoogleSignInButton/GoogleSignInButton";

const features = [
  {
    title: "One view of project health",
    body: "See milestones, blockers, and an at-a-glance health score for every project.",
  },
  {
    title: "GitHub activity",
    body: "Pull requests, commits, and reviews pulled in automatically.",
  },
  {
    title: "Discord discussion",
    body: "Team conversation synced next to the work it is about.",
  },
];

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-6 py-16">
      <header className="flex flex-col gap-4">
        <h1 className="text-5xl font-semibold tracking-tight">DevSync</h1>
        <p className="text-xl text-zinc-600">
          One view of your project plan, GitHub activity, and Discord discussion.
        </p>
        <div>
          <GoogleSignInButton variant="primary" />
        </div>
      </header>
      <ul className="grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <li key={f.title} className="rounded-lg border border-zinc-200 p-4">
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm text-zinc-600">{f.body}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
