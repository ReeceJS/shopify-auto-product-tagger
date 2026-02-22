import { Form, redirect, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  buildRulePayload,
  createRule,
  deleteRule,
  getRuleById,
  updateRule,
} from "../lib/rules.server";
import { RuleFormFields, getRuleFormDefaults } from "../components/RuleFormFields";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const rule = await getRuleById(params.id, session.shop);

  if (!rule) {
    throw new Response("Not found", { status: 404 });
  }

  return { rule, loadKey: Date.now() };
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const formData = await request.formData();
  const intent = formData.get("intent") || url.searchParams.get("intent");

  try {
    if (intent === "delete") {
      await deleteRule(params.id, session.shop);
      return redirect("/app/rules");
    }

    if (intent === "duplicate") {
      const sourceRule = await getRuleById(params.id, session.shop);
      if (sourceRule) {
        const duplicatedRule = await createRule(session.shop, {
          name: `${sourceRule.name} (copy)`,
          description: sourceRule.description,
          enabled: sourceRule.enabled,
          conditions: sourceRule.conditions,
          actions: sourceRule.actions,
        });

        return redirect(`/app/rules/${duplicatedRule.id}`);
      }

      return redirect("/app/rules");
    }

    const payload = buildRulePayload(formData);
    await updateRule(params.id, session.shop, payload);
    
    // Return null to clear actionData after successful save
    return null;
  } catch (error) {
    let errorMessage = "Failed to save rule";

    if (error instanceof Error) {
      // Handle Prisma errors
      if (error.message.includes("Unknown argument")) {
        errorMessage = `Database error: ${error.message}. Try regenerating the database with 'npm run setup'.`;
      } else if (error.message.includes("Unique constraint")) {
        errorMessage = "A rule with this name already exists.";
      } else if (error.message.includes("required") || error.message.includes("validation")) {
        errorMessage = "Please check that all required fields are filled correctly.";
      } else {
        errorMessage = error.message;
      }
    }

    return {
      error: errorMessage,
      values: Object.fromEntries(formData),
    };
  }
};

export default function EditRulePage() {
  const { rule, loadKey } = useLoaderData();
  const actionData = useActionData();

  // Only use actionData values if there's an error (not after successful save)
  const defaults = getRuleFormDefaults(rule, actionData?.error ? actionData.values : undefined);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <s-page heading={rule.name}>
      <style>{`
        .rule-edit-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          align-items: start;
          margin-top: 14px;
        }
        @media (min-width: 1024px) {
          .rule-edit-layout {
            grid-template-columns: 1fr 320px;
          }
        }
      `}</style>
      <div slot="action-menu" style={{ display: "flex", gap: "8px", alignItems: "center", width: "100%" }}>
        <s-button href="/app/rules" variant="tertiary" icon="arrow-left">
          Back
        </s-button>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <Form method="post" action={`/app/rules/${rule.id}?intent=duplicate`} style={{ display: "inline-block" }}>
            <s-button type="submit" variant="tertiary">Duplicate</s-button>
          </Form>
          <Form method="post" action={`/app/rules/${rule.id}?intent=delete`} style={{ display: "inline-block" }}>
            <s-button type="submit" tone="critical">Delete</s-button>
          </Form>
        </div>
      </div>

      <div style={{ marginTop: "24px" }}>
        {actionData?.error ? (
          <s-banner tone="critical" title="Error saving rule">
            <p>{actionData.error}</p>
          </s-banner>
        ) : null}
      </div>

      <Form id="rule-form" method="post" action={`/app/rules/${rule.id}`} data-save-bar>
        <div className="rule-edit-layout">
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <RuleFormFields key={loadKey} defaults={defaults} componentKey={loadKey} />
          </div>

          <s-stack direction="block" gap="base">
            <s-section heading="Status">
              <s-select
                value={rule.enabled ? "enabled" : "disabled"}
                onChange={(e) => {
                  // Update the hidden enabledState input when sidebar select changes
                  const form = document.getElementById('rule-form');
                  const enabledStateInput = form.querySelector('input[name="enabledState"][data-sync]');
                  if (enabledStateInput) {
                    enabledStateInput.value = e.target.value;
                    // Trigger a change event to sync with save-bar
                    enabledStateInput.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                }}
              >
                <s-option value="enabled">Active</s-option>
                <s-option value="disabled">Inactive</s-option>
              </s-select>
            </s-section>

            <s-section heading="History">
              <s-stack direction="block" gap="base">
                <div>
                  <s-text size="100" weight="medium" as="p">Created: </s-text>
                  <div style={{ marginTop: "4px" }}>
                    <s-badge tone="info">{formatDate(rule.createdAt)}</s-badge>
                  </div>
                </div>

                <div>
                  <s-text size="100" weight="medium" as="p">Last updated: </s-text>
                  <div style={{ marginTop: "4px" }}>
                    <s-badge tone="info">{formatDate(rule.updatedAt)}</s-badge>
                  </div>
                </div>
              </s-stack>
            </s-section>
          </s-stack>
        </div>
      </Form>
    </s-page>
  );
}
