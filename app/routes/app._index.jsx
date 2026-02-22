import { Form, useLoaderData, useNavigate, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import { getHomePageData } from "../lib/home.server";
import { enqueueBulkRun } from "../lib/bulk-run.server";
import { triggerBulkRunProcessor } from "../lib/bulk-run-worker.server";

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

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "run-bulk") {
    try {
      await enqueueBulkRun(session.shop);
      triggerBulkRunProcessor();
      return { success: true, message: "Bulk run started" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to start bulk run",
      };
    }
  }

  return null;
};

export default function Index() {
  const { homePageData, error } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();

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
  const connectionTone = status.webhookConnected ? "success" : "warning";

  return (
    <s-page heading="Auto Product Tagger">
      <s-button
        slot="primary-action"
        type="button"
        onClick={() => navigate("/app/rules/new")}
      >
        Create Rule
      </s-button>
      <s-button
        slot="secondary-actions"
        type="button"
        onClick={() => navigate("/app/rules")}
      >
        View Rules
      </s-button>

      {/* App Status Card */}
      <s-section heading="Status Overview" padding="base">
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-badge tone={statusTone(status.automationActive)}>
                {status.automationActive ? "Active" : "Inactive"}
              </s-badge>
              <s-paragraph>
                <strong>Automation:</strong> {status.automationActive ? "Enabled" : "Disabled"}
              </s-paragraph>
            </s-stack>

            <s-stack direction="inline" gap="base" alignItems="center">
              <s-badge>
                {status.activeRuleCount} / {status.ruleLimit}
              </s-badge>
              <s-paragraph>
                <strong>Active Rules:</strong> {status.activeRuleCount} of {status.ruleLimit} rules in use
              </s-paragraph>
            </s-stack>

            <s-stack direction="inline" gap="base" alignItems="center">
              <s-badge tone={connectionTone}>
                {status.webhookConnected ? "Connected" : "Disconnected"}
              </s-badge>
              <s-paragraph>
                <strong>Connection Status:</strong> Webhooks are {status.webhookConnected ? "active" : "inactive"}
              </s-paragraph>
            </s-stack>

            <s-paragraph>
              <strong>Last Activity:</strong>{" "}
              {status.lastExecutionAt
                ? new Date(status.lastExecutionAt).toLocaleString()
                : "No executions yet"}
            </s-paragraph>
          </s-stack>
        </s-box>
      </s-section>

      {/* Quick Actions Card */}
      <s-section heading="Quick Actions" padding="base">
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <s-stack direction="inline" gap="base" wrap="wrap" alignItems="center">
            <s-button type="button" onClick={() => navigate("/app/rules/new")}>
              Create Rule
            </s-button>
            <s-button type="button" onClick={() => navigate("/app/rules")}>
              Manage Rules
            </s-button>
            <Form method="post">
              <s-button type="submit" name="intent" value="run-bulk">
                Run on All Products
              </s-button>
            </Form>
            <s-button type="button" onClick={() => navigate("/app/runs")}>
              View Bulk Runs
            </s-button>
          </s-stack>
        </s-box>
      </s-section>

      {/* Getting Started - Conditional */}
      {!hasRules && (
        <s-section heading="Getting Started" padding="base">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="base">
              <s-heading>Welcome to Auto Product Tagger</s-heading>
              <s-paragraph>
                Follow these steps to get started with automated product tagging.
              </s-paragraph>

              <s-stack direction="block" gap="base">
                <s-box padding="small" borderWidth="base" borderRadius="base">
                  <s-stack direction="inline" gap="base" alignItems="start">
                    <s-badge>1</s-badge>
                    <s-stack direction="block" gap="small">
                      <s-paragraph>
                        <strong>Create Your First Rule</strong>
                      </s-paragraph>
                      <s-paragraph>
                        Define conditions (vendor, price, product type, etc.) and the tags to apply.
                      </s-paragraph>
                      <s-button type="button" onClick={() => navigate("/app/rules/new")} variant="secondary">
                        Create Rule →
                      </s-button>
                    </s-stack>
                  </s-stack>
                </s-box>

                <s-box padding="small" borderWidth="base" borderRadius="base">
                  <s-stack direction="inline" gap="base" alignItems="start">
                    <s-badge>2</s-badge>
                    <s-stack direction="block" gap="small">
                      <s-paragraph>
                        <strong>Test Your Rule</strong>
                      </s-paragraph>
                      <s-paragraph>
                        Edit a product in Shopify Admin. Tags will update automatically when the product matches your rule conditions.
                      </s-paragraph>
                    </s-stack>
                  </s-stack>
                </s-box>

                <s-box padding="small" borderWidth="base" borderRadius="base">
                  <s-stack direction="inline" gap="base" alignItems="start">
                    <s-badge>3</s-badge>
                    <s-stack direction="block" gap="small">
                      <s-paragraph>
                        <strong>Run on All Products</strong>
                      </s-paragraph>
                      <s-paragraph>
                        Apply your rules to your entire catalog with a bulk run.
                      </s-paragraph>
                      <Form method="post">
                        <s-button type="submit" name="intent" value="run-bulk" variant="secondary">
                          Start Bulk Run →
                        </s-button>
                      </Form>
                    </s-stack>
                  </s-stack>
                </s-box>
              </s-stack>
            </s-stack>
          </s-box>
        </s-section>
      )}

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
                View All Rules →
              </s-button>
            </s-stack>
          </s-box>
        </s-section>
      )}
    </s-page>
  );
}
