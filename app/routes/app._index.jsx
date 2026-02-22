import { useLoaderData, useNavigate } from "react-router";
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
  const navigate = useNavigate();

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

  const statusTone = (isActive) => (isActive ? "success" : "critical");

  return (
    <s-page heading="Auto Product Tagger">
      <s-button
        slot="primary-action"
        type="button"
        onClick={() => navigate("/app/rules/new")}
      >
        Create rule
      </s-button>
      <s-button
        slot="secondary-actions"
        type="button"
        onClick={() => navigate("/app/rules")}
      >
        View rules
      </s-button>

      <s-stack direction="block" gap="base">
        {/* Welcome / Onboarding - Conditional */}
        {(!hasRules || !status.automationActive) && (
          <s-section padding="base">
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack direction="block" gap="base">
                <s-heading>Welcome to Auto Product Tagger</s-heading>
                <s-paragraph>
                  Create rules to automatically tag products based on vendor, price, and more.
                </s-paragraph>
                <s-paragraph>Start by creating your first rule.</s-paragraph>
                <s-button type="button" onClick={() => navigate("/app/rules/new")} variant="primary">
                  Create rule
                </s-button>
              </s-stack>
            </s-box>
          </s-section>
        )}

        {/* Status Overview & Quick Actions - Side by side */}
        <s-stack
          direction="inline"
          gap="base"
          wrap
          style={{ rowGap: "var(--s-spacing-base)" }}
        >
          <div style={{ flex: "1 1 360px" }}>
            <s-section heading="Overview" padding="base">
              <s-box padding="base" borderWidth="base" borderRadius="base">
                <s-stack direction="block" gap="base">
                  <s-stack direction="inline" gap="base" alignItems="center">
                    {status.automationActive ? (
                      <s-badge tone={statusTone(status.automationActive)}>
                        Active
                      </s-badge>
                    ) : (
                      <s-badge>Inactive</s-badge>
                    )}
                    <s-paragraph>
                      <strong>Automation:</strong> {status.automationActive ? "Enabled" : "Disabled"}
                    </s-paragraph>
                  </s-stack>

                  <s-stack direction="inline" gap="base" alignItems="center">
                    <s-badge>
                      {status.activeRuleCount} / {status.ruleLimit}
                    </s-badge>
                    <s-paragraph>
                      <strong>Active rules:</strong> {status.activeRuleCount} of {status.ruleLimit} rules in use
                    </s-paragraph>
                  </s-stack>
                </s-stack>
              </s-box>
            </s-section>
          </div>

          <div style={{ flex: "1 1 360px" }}>
            <s-section heading="Quick actions" padding="base">
              <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
                <s-stack direction="inline" gap="base" wrap>
                  <s-button
                    type="button"
                    onClick={() => navigate("/app/rules/new")}
                    variant="primary"
                  >
                    Create rule
                  </s-button>
                  <s-button
                    type="button"
                    onClick={() => navigate("/app/rules")}
                    variant="secondary"
                  >
                    Manage rules
                  </s-button>
                  <s-button
                    type="button"
                    onClick={() => navigate("/app/runs")}
                    variant="secondary"
                  >
                    View bulk runs
                  </s-button>
                </s-stack>
              </s-box>
            </s-section>
          </div>
        </s-stack>

        {/* Active Rules Snapshot */}
        {hasRules && (
          <s-section heading="Recent Rules" padding="base">
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack direction="block" gap="base">
                <s-table>
                  <s-table-header-row>
                    <s-table-header listSlot="primary">Rule Name</s-table-header>
                    <s-table-header>Status</s-table-header>
                    <s-table-header>Conditions</s-table-header>
                    <s-table-header>Tags</s-table-header>
                    <s-table-header>Actions</s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {recentRules.map((rule) => (
                      <s-table-row key={rule.id}>
                        <s-table-cell>
                          <s-link href={`/app/rules/${rule.id}`}>{rule.name}</s-link>
                        </s-table-cell>
                        <s-table-cell>
                          <s-badge tone={rule.enabled ? "success" : "neutral"}>
                            {rule.enabled ? "Active" : "Inactive"}
                          </s-badge>
                        </s-table-cell>
                        <s-table-cell>{rule.conditionCount}</s-table-cell>
                        <s-table-cell>{rule.tagCount}</s-table-cell>
                        <s-table-cell>
                          <s-button type="button" onClick={() => navigate(`/app/rules/${rule.id}`)}>
                            Edit
                          </s-button>
                        </s-table-cell>
                      </s-table-row>
                    ))}
                  </s-table-body>
                </s-table>

                <s-button type="button" onClick={() => navigate("/app/rules")}>
                  View all rules
                </s-button>
              </s-stack>
            </s-box>
          </s-section>
        )}
      </s-stack>
    </s-page>
  );
}
