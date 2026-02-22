import { authenticate } from "../shopify.server";
import { applyRulesToProductId } from "../lib/product-tagging.server";

export const action = async ({ request }) => {
  const { payload, admin, shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (!admin || !payload?.admin_graphql_api_id) {
    return new Response();
  }

  await applyRulesToProductId({
    admin,
    shop,
    productId: payload.admin_graphql_api_id,
  });

  return new Response();
};
