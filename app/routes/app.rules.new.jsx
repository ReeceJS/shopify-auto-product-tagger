import { Form, redirect, useActionData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { RuleFormFields, getRuleFormDefaults } from "../components/RuleFormFields";
import { buildRulePayload, createRule } from "../lib/rules.server";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  try {
    const payload = buildRulePayload(formData);
    await createRule(session.shop, payload);
    return redirect("/app/rules");
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create rule",
      values: Object.fromEntries(formData),
    };
  }
};

export default function NewRulePage() {
  const actionData = useActionData();
  const navigate = useNavigate();
  const defaults = getRuleFormDefaults(null, actionData?.values);

  return (
    <s-page heading="Create rule">
      <Form method="post">
        <s-section>
          {actionData?.error ? <p style={{ color: "#8e1f0b" }}>{actionData.error}</p> : null}
          <s-stack direction="block" gap="base">
            <RuleFormFields defaults={defaults} />
            <s-stack direction="inline" gap="base">
              <s-button type="submit">Create rule</s-button>
              <s-button type="button" tone="critical" onClick={() => navigate("/app/rules")}>
                Cancel
              </s-button>
            </s-stack>
          </s-stack>
        </s-section>
      </Form>
    </s-page>
  );
}
