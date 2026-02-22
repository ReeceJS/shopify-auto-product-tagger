import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getHomePageData } from "../lib/home.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  try {
    const homePageData = await getHomePageData(session.shop);
    return { homePageData, error: null };
  } catch (error) {
    return {
      homePageData: null,
      error: error instanceof Error ? error.message : "Failed to load home page data",
    };
  }
};

export default function Index() {
  const { homePageData, error } = useLoaderData();

  if (error) {
    return (
      <s-page heading="Auto Product Tagger">
        <s-section>
          <s-banner tone="critical" title="Error loading page">
            <s-paragraph>{error}</s-paragraph>
          </s-banner>
        </s-section>
      </s-page>
    );
  }

  if (!homePageData) {
    return (
      <s-page heading="Auto Product Tagger">
        <s-section>
          <s-paragraph>Loading...</s-paragraph>
        </s-section>
      </s-page>
    );
  }

  const { status, recentRules, hasRules } = homePageData;

  return (
    <s-page heading="Auto Product Tagger">
      {/* TODO Phase 2: Replace with Polaris components */}
      {/* 1. Page Header with actions */}
      {/* 2. App Status Card */}
      {/* 3. Quick Actions Card */}
      {/* 4. Getting Started (conditional) */}
      {/* 5. Active Rules Snapshot */}

      <s-section heading="Status" padding="base">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            <strong>Automation Active:</strong> {status.automationActive ? "Yes" : "No"}
          </s-paragraph>
          <s-paragraph>
            <strong>Active Rules:</strong> {status.activeRuleCount} / {status.ruleLimit}
          </s-paragraph>
          <s-paragraph>
            <strong>Webhook Status:</strong> {status.webhookConnected ? "Connected" : "Not Connected"}
          </s-paragraph>
          <s-paragraph>
            <strong>Last Execution:</strong>{" "}
            {status.lastExecutionAt
              ? new Date(status.lastExecutionAt).toLocaleString()
              : "No executions yet"}
          </s-paragraph>
        </s-stack>
      </s-section>

      {hasRules && (
        <s-section heading="Recent Rules" padding="base">
          <s-stack direction="block" gap="base">
            {recentRules.map((rule) => (
              <s-paragraph key={rule.id}>
                {rule.name} - {rule.enabled ? "Active" : "Inactive"} - {rule.conditionCount}{" "}
                conditions, {rule.tagCount} tags
              </s-paragraph>
            ))}
          </s-stack>
        </s-section>
      )}

      {!hasRules && (
        <s-section heading="Getting Started" padding="base">
          <s-paragraph>Create your first rule to get started with automated product tagging.</s-paragraph>
        </s-section>
      )}
    </s-page>
  );
}
