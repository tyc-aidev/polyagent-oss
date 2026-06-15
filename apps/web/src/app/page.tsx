import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-6">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">PolyAgent OSS</h1>
        <p className="text-zinc-400 text-lg">
          Open-source, self-hostable platform for paper trading prediction market bots.
        </p>
        <p className="text-amber-200/80 text-sm">
          Educational and research purposes only. Not financial advice.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/markets"
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium hover:bg-teal-500 transition-colors"
          >
            Open Dashboard
          </Link>
          <Link
            href="/demo"
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium hover:border-zinc-500 transition-colors"
          >
            View Demo
          </Link>
        </div>
      </div>
    </div>
  );
}