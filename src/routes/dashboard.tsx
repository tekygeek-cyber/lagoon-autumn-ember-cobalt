import { createFileRoute } from "@tanstack/react-router";
import { Desk } from "@/components/desk";

type DashSearch = { sample: boolean };

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): DashSearch => ({
    sample: search.sample === true || search.sample === "1" || search.sample === "true",
  }),
  component: DashboardRoute,
});

function DashboardRoute() {
  const { sample } = Route.useSearch();
  return <Desk sample={sample} />;
}
