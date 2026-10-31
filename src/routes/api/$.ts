import { createFileRoute } from "@tanstack/react-router";
import { handlePublishedDesk } from "@/lib/desk/published.server";

function requestUrl(request: Request): URL {
  try {
    return new URL(request.url);
  } catch {
    return new URL(request.url, "https://desk.invalid");
  }
}

function upstreamPath(url: URL): string {
  const stripped = url.pathname.replace(/^\/hds-[^/]+/i, "") || "/";
  return `${stripped}${url.search}`;
}

async function proxy(request: Request): Promise<Response> {
  try {
    return await handlePublishedDesk(request, upstreamPath(requestUrl(request)));
  } catch (error) {
    console.error("[desk-api]", error instanceof Error ? error.message : "failed");
    return Response.json(
      { detail: "The desk service is not running. Start the Python API and try again." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: ({ request }) => proxy(request),
      POST: ({ request }) => proxy(request),
      PUT: ({ request }) => proxy(request),
      PATCH: ({ request }) => proxy(request),
      DELETE: ({ request }) => proxy(request),
    },
  },
});
