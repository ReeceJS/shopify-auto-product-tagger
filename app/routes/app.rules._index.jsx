import { Form, useActionData, useLoaderData, useNavigate, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getRulesForShop,
  updateRule,
  getActiveRuleCount,
} from "../lib/rules.server";
import { getLatestRun, enqueueBulkRun } from "../lib/bulk-run.server";
import { triggerBulkRunProcessor } from "../lib/bulk-run-worker.server";

const MAX_ACTIVE_RULES = 50;

const CONDITION_LABELS = {
  vendor: "vendor",
  productType: "product type",
  title: "title",
  minVariantPrice: "min variant price",
  maxVariantPrice: "max variant price",
  weight: "weight",
  status: "status",
  onSale: "on sale",
  collection: "collection handle",
  inventoryQuantity: "inventory quantity",
};

const OPERATOR_LABELS = {
  contains: "contains",
  equals: "equals",
  greater_than: ">",
  less_than: "<",
  is: "is",
};

const summarizeConditions = (conditions) => {
  if (!conditions) return "-";

  if (Array.isArray(conditions)) {
    const parts = conditions.map((condition) => {
      const field = CONDITION_LABELS[condition.field] || condition.field;
      const operator = OPERATOR_LABELS[condition.operator] || condition.operator;
      return `${field} ${operator} ${condition.value}`;
    });
    return parts.join(" AND ") || "-";
  }

  const groups = Array.isArray(conditions.groups) ? conditions.groups : [];
  if (!groups.length) return "-";

  const groupStrings = groups
    .map((group) => {
      const conditionParts = (group.conditions || [])
        .map((condition) => {
          const field = CONDITION_LABELS[condition.field] || condition.field;
          const operator = OPERATOR_LABELS[condition.operator] || condition.operator;
          return `${field} ${operator} ${condition.value}`;
        })
        .filter(Boolean);

      if (!conditionParts.length) return null;
      const joiner = group.joiner === "OR" ? " OR " : " AND ";
      return `(${conditionParts.join(joiner)})`;
    })
    .filter(Boolean);

  if (!groupStrings.length) return "-";
  const groupJoiner = conditions.groupJoiner === "OR" ? " OR " : " AND ";
  return groupStrings.join(groupJoiner);
};

const summarizeActions = (actions) => {
  if (!actions) return "-";

  if (Array.isArray(actions.items)) {
    const items = actions.items
      .map((item) => {
        const tags = Array.isArray(item.tags) ? item.tags : [];
        if (!tags.length) return null;
        return `${item.type === "remove" ? "remove" : "add"}: ${tags.join(", ")}`;
      })
      .filter(Boolean);

    return items.join(" | ") || "-";
  }

  const parts = [];
  if (Array.isArray(actions.addTags) && actions.addTags.length) {
    parts.push(`add: ${actions.addTags.join(", ")}`);
  }
  if (Array.isArray(actions.removeTags) && actions.removeTags.length) {
    parts.push(`remove: ${actions.removeTags.join(", ")}`);
  }
  return parts.join(" | ") || "-";
};

const formatUpdatedTime = (value) => {
  const updatedAt = new Date(value);
  const now = Date.now();
  const diffMs = now - updatedAt.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 12) {
    return `${diffHours}h ago`;
  }

  return updatedAt.toLocaleDateString();
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const sortBy = url.searchParams.get("sort") || "created_desc";
  const filterStatus = url.searchParams.get("status") || "all";
  const actionType = url.searchParams.get("actionType") || "all";
  const searchQuery = url.searchParams.get("q") || "";

  const [rules, latestRun, activeRuleCount] = await Promise.all([
    getRulesForShop(session.shop, {
      sortBy,
      filterStatus,
      actionType,
      searchQuery,
    }),
    getLatestRun(session.shop),
    getActiveRuleCount(session.shop),
  ]);

  return {
    rules,
    latestRun,
    sortBy,
    filterStatus,
    actionType,
    searchQuery,
    activeRuleCount,
    maxActiveRules: MAX_ACTIVE_RULES,
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || url.searchParams.get("intent") || "");
  const ruleId = String(formData.get("ruleId") || url.searchParams.get("ruleId") || "");

  if (intent === "run-all") {
    await enqueueBulkRun(session.shop);
    triggerBulkRunProcessor();
    return null;
  }

  if (intent === "update-status" && ruleId) {
    try {
      const status = String(formData.get("status") || "active");
      await updateRule(ruleId, session.shop, {
        enabled: status === "active",
      });
      return null;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Failed to update rule status",
      };
    }
  }

  return null;
};

export default function RulesIndexPage() {
  const {
    rules,
    latestRun,
    sortBy,
    filterStatus,
    actionType,
    searchQuery,
    activeRuleCount,
    maxActiveRules,
  } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const hasAppliedFilters =
    sortBy !== "created_desc" ||
    filterStatus !== "all" ||
    actionType !== "all" ||
    searchQuery.trim().length > 0;

  const approachingLimit = activeRuleCount >= maxActiveRules * 0.8;
  const atLimit = activeRuleCount >= maxActiveRules;

  return (
    <s-page heading="Rules">
      <s-button slot="primary-action" type="button" onClick={() => navigate("/app/rules/new")}>
        Create rule
      </s-button>
      <s-button slot="secondary-actions" type="button" onClick={() => navigate("/app/runs")}>
        View runs
      </s-button>

      <s-section accessibilityLabel="Breadcrumbs">
        <s-stack direction="inline" gap="small">
          <s-link href="/app">Overview</s-link>
          <s-paragraph>/</s-paragraph>
          <s-paragraph>Rules</s-paragraph>
        </s-stack>
      </s-section>

      {actionData?.error && (
        <s-section>
          <s-banner tone="critical" title="Failed to update rule">
            <s-paragraph>{actionData.error}</s-paragraph>
          </s-banner>
        </s-section>
      )}

      {approachingLimit && (
        <s-section>
          <s-banner
            tone={atLimit ? "critical" : "warning"}
            title={
              atLimit
                ? "Active rule limit reached"
                : "Approaching active rule limit"
            }
          >
            <s-paragraph>
              {atLimit
                ? `You have ${activeRuleCount} of ${maxActiveRules} active rules. Disable an existing rule before enabling another.`
                : `You have ${activeRuleCount} of ${maxActiveRules} active rules. Consider disabling unused rules to stay within the limit.`}
            </s-paragraph>
          </s-banner>
        </s-section>
      )}

      <s-section>
        <s-grid gridTemplateColumns="1fr auto" gap="small-400" alignItems="start">
          <s-grid
            gridTemplateColumns="@container (inline-size <= 640px) 1fr, auto auto"
            gap="base"
            alignItems="center"
          >
            <s-grid gap="small-200">
              <s-heading>Run rules across your catalog</s-heading>
              <s-paragraph>
                Apply the current active rules to all products and monitor progress.
              </s-paragraph>
              <Form method="post">
                <s-stack direction="inline" gap="small-200">
                  <s-button type="submit" name="intent" value="run-all">
                    Run on all products
                  </s-button>
                </s-stack>
              </Form>
            </s-grid>
            <s-stack alignItems="center">
              <s-box maxInlineSize="200px" borderRadius="base" overflow="hidden">
                <s-image
                  src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
                  alt="Bulk run illustration"
                  aspectRatio="1/0.5"
                ></s-image>
              </s-box>
            </s-stack>
          </s-grid>
          <s-badge tone={latestRun?.status === "failed" ? "critical" : "info"}>
            {latestRun
              ? `${latestRun.status} · processed ${latestRun.processed} · updated ${latestRun.updated} · errors ${latestRun.errors}`
              : "No runs yet"}
          </s-badge>
        </s-grid>
      </s-section>

      <s-section padding="none" accessibilityLabel="Rules index section">
        <Form method="get" id="filters-form">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="base">
              <div style={{ minWidth: "250px", maxWidth: "320px" }}>
                <s-text-field
                  name="q"
                  label="Search rules"
                  value={searchQuery}
                ></s-text-field>
              </div>

              <div style={{ minWidth: "220px", maxWidth: "280px" }}>
                <s-select
                  name="sort"
                  label="Sort"
                  value={sortBy}
                  onChange={(event) => {
                    const form = event.currentTarget.closest("form");
                    if (form) submit(form);
                  }}
                >
                  <s-option value="created_desc">Newest to oldest</s-option>
                  <s-option value="created_asc">Oldest to newest</s-option>
                </s-select>
              </div>

              <div style={{ minWidth: "180px", maxWidth: "220px" }}>
                <s-select
                  name="status"
                  label="Filter"
                  value={filterStatus}
                  onChange={(event) => {
                    const form = event.currentTarget.closest("form");
                    if (form) submit(form);
                  }}
                >
                  <s-option value="all">All</s-option>
                  <s-option value="active">Active</s-option>
                  <s-option value="inactive">Inactive</s-option>
                </s-select>
              </div>

              <div style={{ minWidth: "210px", maxWidth: "250px" }}>
                <s-select
                  name="actionType"
                  label="Action type"
                  value={actionType}
                  onChange={(event) => {
                    const form = event.currentTarget.closest("form");
                    if (form) submit(form);
                  }}
                >
                  <s-option value="all">All actions</s-option>
                  <s-option value="add">Add tag(s)</s-option>
                  <s-option value="remove">Remove tag(s)</s-option>
                </s-select>
              </div>

              <s-button type="submit">Search</s-button>

              {hasAppliedFilters ? (
                <s-button
                  type="button"
                  tone="neutral"
                  variant="tertiary"
                  onClick={() => navigate("/app/rules")}
                >
                  Clear filters
                </s-button>
              ) : null}
            </s-stack>
          </s-box>
        </Form>

        {rules.length === 0 ? (
          <s-section accessibilityLabel="Empty state section">
            <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
              <s-box maxInlineSize="200px" maxBlockSize="200px">
                <s-image
                  aspectRatio="1/0.5"
                  src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
                  alt="No rules created"
                ></s-image>
              </s-box>
              <s-grid justifyItems="center" maxInlineSize="450px" gap="base">
                <s-stack alignItems="center">
                  <s-heading>Create your first rule</s-heading>
                  <s-paragraph>
                    Rules let you automatically add or remove tags as products are created or updated.
                  </s-paragraph>
                </s-stack>
                <s-button-group>
                  <s-button type="button" onClick={() => navigate("/app/rules/new")}>
                    Create rule
                  </s-button>
                </s-button-group>
              </s-grid>
            </s-grid>
          </s-section>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Rule</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Summary</s-table-header>
              <s-table-header>Updated</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rules.map((rule) => (
                <s-table-row key={rule.id}>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small" alignItems="center">
                      <s-link href={`/app/rules/${rule.id}`}>{rule.name}</s-link>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <Form method="post" action={`/app/rules?ruleId=${rule.id}&intent=update-status`}>
                      <s-stack direction="inline" gap="small" alignItems="center">
                        <s-badge tone={rule.enabled ? "success" : "neutral"}>
                          {rule.enabled ? "Active" : "Inactive"}
                        </s-badge>
                        <div style={{ minWidth: "170px" }}>
                          <s-select
                            name="status"
                            label=""
                            value={rule.enabled ? "active" : "inactive"}
                            onChange={(event) => {
                              const form = event.currentTarget.closest("form");
                              if (!form) return;
                              submit(form, { method: "post" });
                            }}
                          >
                            <s-option value="active">Set active</s-option>
                            <s-option value="inactive">Set inactive</s-option>
                          </s-select>
                        </div>
                      </s-stack>
                    </Form>
                  </s-table-cell>
                  <s-table-cell>
                    {rule.description ? (
                      <s-paragraph>{rule.description}</s-paragraph>
                    ) : (
                      <s-stack direction="block" gap="small-200">
                        <s-paragraph><strong>Conditions:</strong> {summarizeConditions(rule.conditions)}</s-paragraph>
                        <s-paragraph><strong>Tags:</strong> {summarizeActions(rule.actions)}</s-paragraph>
                      </s-stack>
                    )}
                  </s-table-cell>
                  <s-table-cell>{formatUpdatedTime(rule.updatedAt)}</s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small">
                      <s-button type="button" onClick={() => navigate(`/app/rules/${rule.id}`)}>
                        Edit
                      </s-button>
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}
