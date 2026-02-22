import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return null;
};

export default function Index() {
  return (
    <s-page heading="Auto Product Tagger">
      <s-section heading="Rules-based product tagging">
        <s-paragraph>
          Create rules with AND conditions, then automatically add or remove
          tags when products are created or updated.
        </s-paragraph>
      </s-section>

      <s-section heading="How it works">
        <s-paragraph>
          Webhooks handle near real-time product updates, and bulk runs apply
          rules across the full catalog with progress tracking.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-link href="/app/rules">Manage rules</s-link>
          <s-link href="/app/runs">View bulk runs</s-link>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Supported conditions">
        <s-paragraph>
          vendor (contains, equals)
        </s-paragraph>
        <s-paragraph>
          productType (equals)
        </s-paragraph>
        <s-paragraph>
          title (contains)
        </s-paragraph>
        <s-paragraph>
          minVariantPrice (greater than, less than, equals)
        </s-paragraph>
        <s-paragraph>
          status (active, draft, archived)
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="UAT flow">
        <s-paragraph>1) Create a rule in Rules.</s-paragraph>
        <s-paragraph>2) Edit a product and confirm webhook tag updates.</s-paragraph>
        <s-paragraph>3) Run bulk tagging and check progress in Runs.</s-paragraph>
        <s-paragraph>4) Test a rule on a selected product in rule edit.</s-paragraph>
      </s-section>
    </s-page>
  );
}
