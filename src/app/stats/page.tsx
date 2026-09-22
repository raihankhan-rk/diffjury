import { getAnalyzeStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const stats = await getAnalyzeStats();

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <p className="text-2xl font-semibold">PRs analyzed: {stats.analyzes}</p>
    </main>
  );
}
