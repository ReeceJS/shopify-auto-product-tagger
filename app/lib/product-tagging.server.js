import { evaluateRulesForProduct } from "./rules-engine.server";
import { getEnabledRulesForShop } from "./rules.server";
import { getProductById, updateProductTags } from "./products.server";

export const applyRulesToProductId = async ({ admin, shop, productId }) => {
  const rules = await getEnabledRulesForShop(shop);
  if (!rules.length) {
    return { changed: false, reason: "No enabled rules" };
  }

  const product = await getProductById(admin, productId);
  if (!product) {
    return { changed: false, reason: "Product not found" };
  }

  const diff = evaluateRulesForProduct(product, rules);
  if (!diff.changed) {
    return { changed: false, diff };
  }

  await updateProductTags(admin, product.id, diff.afterTags);

  return {
    changed: true,
    diff,
  };
};
