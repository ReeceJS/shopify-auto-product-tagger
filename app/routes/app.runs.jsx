import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const runs = await db.bulkRun.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return { runs };
};

export default function RunsPage() {
  const { runs } = useLoaderData();

  const statusTone = (status) => {
    if (status === "failed") return "critical";
    if (status === "completed") return "success";
    if (status === "running") return "info";
    return "neutral";
  };

  return (
    <s-page heading="Bulk runs">
      <s-section>
        {runs.length === 0 ? (
          <s-paragraph>No runs yet.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {runs.map((run) => (
              <s-box key={run.id} padding="base" borderWidth="base" borderRadius="base">
                <s-stack direction="block" gap="small">
                  <s-stack direction="inline" gap="base">
                    <s-heading>{new Date(run.createdAt).toLocaleString()}</s-heading>
                    <s-badge tone={statusTone(run.status)}>{run.status}</s-badge>
                  </s-stack>
                  <s-paragraph>
                    Processed: {run.processed} · Updated: {run.updated} · Errors: {run.errors}
                  </s-paragraph>
                  <s-paragraph>Last error: {run.lastError || "-"}</s-paragraph>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}
