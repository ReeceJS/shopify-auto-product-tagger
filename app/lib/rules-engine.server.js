const normalizeTag = (tag) => tag.trim();

const parseNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getMinVariantPrice = (product) => {
  const prices = (product.variants?.nodes || [])
    .map((variant) => parseNumber(variant.price))
    .filter((price) => price !== null);

  if (!prices.length) {
    return null;
  }

  return Math.min(...prices);
};

const getMaxVariantPrice = (product) => {
  const prices = (product.variants?.nodes || [])
    .map((variant) => parseNumber(variant.price))
    .filter((price) => price !== null);

  if (!prices.length) {
    return null;
  }

  return Math.max(...prices);
};

const getTotalInventoryQuantity = (product) => {
  const quantities = (product.variants?.nodes || [])
    .map((variant) => parseNumber(variant.inventoryQuantity))
    .filter((qty) => qty !== null);

  if (!quantities.length) {
    return 0;
  }

  return quantities.reduce((sum, qty) => sum + qty, 0);
};

const isProductOnSale = (product) => {
  // A product is "on sale" if any variant has a compareAtPrice and price < compareAtPrice
  const variants = product.variants?.nodes || [];
  
  // Debug logging
  console.log("Checking onSale for product:", product.id, product.title);
  console.log("Variants:", JSON.stringify(variants, null, 2));
  
  const onSale = variants.some((variant) => {
    const price = parseNumber(variant.price);
    const compareAtPrice = parseNumber(variant.compareAtPrice);
    console.log(`Variant - price: ${variant.price}, compareAtPrice: ${variant.compareAtPrice}, parsed price: ${price}, parsed compareAtPrice: ${compareAtPrice}`);
    return price !== null && compareAtPrice !== null && price < compareAtPrice;
  });
  
  console.log("Product onSale result:", onSale);
  return onSale;
};

const matchesCondition = (product, condition) => {
  const { field, operator, value } = condition;

  if (!field || !operator) {
    return false;
  }

  switch (field) {
    case "vendor": {
      const vendor = (product.vendor || "").toLowerCase();
      const target = String(value || "").toLowerCase();
      if (operator === "contains") return vendor.includes(target);
      if (operator === "equals") return vendor === target;
      return false;
    }
    case "productType": {
      if (operator !== "equals") return false;
      return (product.productType || "").toLowerCase() === String(value || "").toLowerCase();
    }
    case "title": {
      const title = (product.title || "").toLowerCase();
      const target = String(value || "").toLowerCase();
      if (operator !== "contains") return false;
      return title.includes(target);
    }
    case "minVariantPrice": {
      const minPrice = getMinVariantPrice(product);
      const target = parseNumber(value);
      if (minPrice === null || target === null) return false;
      if (operator === "greater_than") return minPrice > target;
      if (operator === "greater_than_or_equal") return minPrice >= target;
      if (operator === "less_than") return minPrice < target;
      if (operator === "less_than_or_equal") return minPrice <= target;
      if (operator === "equals") return minPrice === target;
      return false;
    }
    case "status": {
      if (operator !== "equals") return false;
      return (product.status || "").toLowerCase() === String(value || "").toLowerCase();
    }
    case "maxVariantPrice": {
      const maxPrice = getMaxVariantPrice(product);
      const target = parseNumber(value);
      if (maxPrice === null || target === null) return false;
      if (operator === "greater_than") return maxPrice > target;
      if (operator === "greater_than_or_equal") return maxPrice >= target;
      if (operator === "less_than") return maxPrice < target;
      if (operator === "less_than_or_equal") return maxPrice <= target;
      if (operator === "equals") return maxPrice === target;
      return false;
    }
    case "weight": {
      // Weight data not currently available from GraphQL API
      // TODO: Implement when weight field becomes available
      // For now, always return false since weight cannot be evaluated
      return false;
    }
    case "onSale": {
      if (operator !== "equals") return false;
      const onSale = isProductOnSale(product);
      const targetOnSale = String(value) === "true";
      return onSale === targetOnSale;
    }
    case "collection": {
      const collectionHandles = (product.collections?.nodes || [])
        .map((col) => col.handle)
        .filter(Boolean);
      const target = String(value || "").toLowerCase();
      if (operator === "contains") {
        return collectionHandles.some((handle) => handle.includes(target));
      }
      if (operator === "equals") {
        return collectionHandles.some((handle) => handle === target);
      }
      return false;
    }
    case "inventoryQuantity": {
      const totalInventory = getTotalInventoryQuantity(product);
      const target = parseNumber(value);
      if (target === null) return false;
      if (operator === "greater_than") return totalInventory > target;
      if (operator === "greater_than_or_equal") return totalInventory >= target;
      if (operator === "less_than") return totalInventory < target;
      if (operator === "less_than_or_equal") return totalInventory <= target;
      if (operator === "equals") return totalInventory === target;
      return false;
    }
    default:
      return false;
  }
};

const normalizeConditionModel = (conditions) => {
  if (Array.isArray(conditions)) {
    return {
      groupJoiner: "AND",
      groups: [
        {
          joiner: "AND",
          conditions,
        },
      ],
    };
  }

  if (conditions && typeof conditions === "object" && Array.isArray(conditions.groups)) {
    return {
      groupJoiner: conditions.groupJoiner === "OR" ? "OR" : "AND",
      groups: conditions.groups.map((group) => ({
        joiner: group?.joiner === "OR" ? "OR" : "AND",
        conditions: Array.isArray(group?.conditions) ? group.conditions : [],
      })),
    };
  }

  return {
    groupJoiner: "AND",
    groups: [],
  };
};

const evaluateGroupedConditions = (product, conditions) => {
  const model = normalizeConditionModel(conditions);
  if (!model.groups.length) {
    return false;
  }

  const groupResults = model.groups
    .map((group) => {
      if (!group.conditions.length) {
        return false;
      }

      const conditionResults = group.conditions.map((condition) =>
        matchesCondition(product, condition),
      );

      if (group.joiner === "OR") {
        return conditionResults.some(Boolean);
      }

      return conditionResults.every(Boolean);
    })
    .filter((result) => result !== null);

  if (!groupResults.length) {
    return false;
  }

  if (model.groupJoiner === "OR") {
    return groupResults.some(Boolean);
  }

  return groupResults.every(Boolean);
};

const getRuleActions = (rule) => {
  if (Array.isArray(rule.actions?.items)) {
    const addTags = [];
    const removeTags = [];

    for (const item of rule.actions.items) {
      const tags = Array.isArray(item.tags)
        ? item.tags.map(normalizeTag).filter(Boolean)
        : [];

      if (item.type === "remove") {
        removeTags.push(...tags);
      } else {
        addTags.push(...tags);
      }
    }

    return { addTags, removeTags };
  }

  const addTags = Array.isArray(rule.actions?.addTags)
    ? rule.actions.addTags.map(normalizeTag).filter(Boolean)
    : [];
  const removeTags = Array.isArray(rule.actions?.removeTags)
    ? rule.actions.removeTags.map(normalizeTag).filter(Boolean)
    : [];

  return { addTags, removeTags };
};

export const evaluateRulesForProduct = (product, rules) => {
  const startingTags = new Set(Array.isArray(product.tags) ? product.tags : []);
  const matchedRuleIds = [];
  const allTagsToAdd = new Set();
  const allTagsToRemove = new Set();

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const matched = evaluateGroupedConditions(product, rule.conditions);

    if (!matched) continue;

    matchedRuleIds.push(rule.id);
    const { addTags, removeTags } = getRuleActions(rule);
    addTags.forEach((tag) => allTagsToAdd.add(tag));
    removeTags.forEach((tag) => allTagsToRemove.add(tag));
  }

  const finalTags = new Set(startingTags);
  allTagsToAdd.forEach((tag) => finalTags.add(tag));
  allTagsToRemove.forEach((tag) => finalTags.delete(tag));

  const addedTags = [...finalTags].filter((tag) => !startingTags.has(tag));
  const removedTags = [...startingTags].filter((tag) => !finalTags.has(tag));

  return {
    matchedRuleIds,
    beforeTags: [...startingTags].sort(),
    afterTags: [...finalTags].sort(),
    addedTags: addedTags.sort(),
    removedTags: removedTags.sort(),
    changed: addedTags.length > 0 || removedTags.length > 0,
  };
};
