import db from "../db.server";

/**
 * Rule execution limits for performance and system stability:
 *
 * 1. Active Rules Per Shop: Maximum of 50 active rules per shop to prevent
 *    performance degradation during bulk runs.
 *
 * 2. Bulk Run Processing: Already handled by the queue system in bulk-run.server.js
 *    - One bulk run processes at a time (via isProcessing flag)
 *    - Products fetched page by page to manage memory
 *    - All active rules applied sequentially to each product
 *
 * The active rule limit is enforced when:
 * - Creating a new rule that is enabled
 * - Enabling an existing rule via update
 */
const MAX_ACTIVE_RULES_PER_SHOP = 50;

const splitTags = (value) =>
  String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const SUPPORTED_OPERATORS_BY_FIELD = {
  vendor: ["contains", "equals"],
  productType: ["equals"],
  title: ["contains"],
  minVariantPrice: ["greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "equals"],
  maxVariantPrice: ["greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "equals"],
  weight: ["greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "equals"],
  status: ["equals"],
  onSale: ["equals"],
  collection: ["contains", "equals"],
  inventoryQuantity: ["greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "equals"],
};

const parseJson = (value, label) => {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    throw new Error(`Invalid ${label} payload`);
  }
};

const sanitizeConditions = (rawConditions) => {
  if (Array.isArray(rawConditions)) {
    return {
      groupJoiner: "AND",
      groups: [
        {
          joiner: "AND",
          conditions: rawConditions
            .filter((condition) => condition?.field && condition?.operator)
            .map((condition) => ({
              field: condition.field,
              operator: condition.operator,
              value: String(condition.value || "").trim(),
            }))
            .filter((condition) => condition.value),
        },
      ],
    };
  }

  const groupJoiner = rawConditions?.groupJoiner === "OR" ? "OR" : "AND";
  const groups = Array.isArray(rawConditions?.groups) ? rawConditions.groups : [];

  return {
    groupJoiner,
    groups: groups.map((group) => ({
      joiner: group?.joiner === "OR" ? "OR" : "AND",
      conditions: Array.isArray(group?.conditions)
        ? group.conditions
            .filter((condition) => condition?.field && condition?.operator)
            .map((condition) => ({
              field: condition.field,
              operator: condition.operator,
              value: String(condition.value || "").trim(),
            }))
            .filter((condition) => condition.value)
        : [],
    })),
  };
};

const validateConditions = (conditions) => {
  const filteredGroups = conditions.groups
    .map((group) => ({
      joiner: group.joiner,
      conditions: group.conditions.filter((condition) => {
        const supportedOperators = SUPPORTED_OPERATORS_BY_FIELD[condition.field];
        if (!supportedOperators) return false;
        return supportedOperators.includes(condition.operator);
      }),
    }))
    .filter((group) => group.conditions.length > 0);

  if (!filteredGroups.length) {
    throw new Error("At least one condition is required");
  }

  return {
    groupJoiner: conditions.groupJoiner,
    groups: filteredGroups,
  };
};

const sanitizeActions = (rawActions) => {
  const actionItems = Array.isArray(rawActions?.items) ? rawActions.items : [];

  const items = actionItems
    .map((item) => ({
      type: item?.type === "remove" ? "remove" : "add",
      tags: splitTags(item?.tagsText || item?.tags || ""),
    }))
    .filter((item) => item.tags.length > 0);

  if (!items.length && (rawActions?.addTags || rawActions?.removeTags)) {
    const fallbackItems = [];
    if (Array.isArray(rawActions.addTags) && rawActions.addTags.length) {
      fallbackItems.push({ type: "add", tags: rawActions.addTags });
    }
    if (Array.isArray(rawActions.removeTags) && rawActions.removeTags.length) {
      fallbackItems.push({ type: "remove", tags: rawActions.removeTags });
    }
    return { items: fallbackItems };
  }

  return { items };
};

export const buildRulePayload = (formData) => {
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const enabled = String(formData.get("enabledState") || "enabled") === "enabled";

  const parsedConditions = parseJson(formData.get("conditionsConfig"), "conditions");
  const conditions = validateConditions(sanitizeConditions(parsedConditions));

  const parsedActions = parseJson(formData.get("actionsConfig"), "actions");
  const actions = sanitizeActions(parsedActions);

  if (!name) {
    throw new Error("Rule name is required");
  }

  if (!actions.items.length) {
    throw new Error("At least one tag action is required");
  }

  return {
    name,
    description: description || null,
    enabled,
    conditions,
    actions,
  };
};

export const getRulesForShop = (shop, options = {}) => {
  const filterStatus = options.filterStatus || "all";
  const sortBy = options.sortBy || "created_desc";
  const searchQuery = String(options.searchQuery || "").trim().toLowerCase();
  const actionType = options.actionType || "all";

  const where = { shop };
  if (filterStatus === "active") {
    where.enabled = true;
  } else if (filterStatus === "inactive") {
    where.enabled = false;
  }

  const orderBy =
    sortBy === "created_asc"
      ? { createdAt: "asc" }
      : { createdAt: "desc" };

  return db.rule.findMany({
    where,
    orderBy,
  }).then((rules) => {
    let filtered = rules;

    if (searchQuery) {
      filtered = filtered.filter((rule) =>
        String(rule.name || "").toLowerCase().includes(searchQuery),
      );
    }

    if (actionType !== "all") {
      filtered = filtered.filter((rule) => {
        const actionItems = Array.isArray(rule.actions?.items)
          ? rule.actions.items
          : [
              ...(Array.isArray(rule.actions?.addTags) && rule.actions.addTags.length
                ? [{ type: "add", tags: rule.actions.addTags }]
                : []),
              ...(Array.isArray(rule.actions?.removeTags) && rule.actions.removeTags.length
                ? [{ type: "remove", tags: rule.actions.removeTags }]
                : []),
            ];

        return actionItems.some((item) => item?.type === actionType);
      });
    }

    return filtered;
  });
};

export const getEnabledRulesForShop = (shop) => {
  return db.rule.findMany({
    where: { shop, enabled: true },
    orderBy: { updatedAt: "desc" },
  });
};

export const getRuleById = (id, shop) => {
  return db.rule.findFirst({
    where: { id, shop },
  });
};

export const getActiveRuleCount = async (shop) => {
  return db.rule.count({
    where: { shop, enabled: true },
  });
};

export const checkActiveRuleLimit = async (shop, excludeRuleId = null) => {
  const activeCount = await db.rule.count({
    where: {
      shop,
      enabled: true,
      ...(excludeRuleId ? { id: { not: excludeRuleId } } : {}),
    },
  });

  if (activeCount >= MAX_ACTIVE_RULES_PER_SHOP) {
    throw new Error(
      `Maximum active rule limit reached (${MAX_ACTIVE_RULES_PER_SHOP}). Disable an existing rule before enabling another.`
    );
  }

  return activeCount;
};

export const createRule = async (shop, payload) => {
  // Check limit if creating an enabled rule
  if (payload.enabled) {
    await checkActiveRuleLimit(shop);
  }

  return db.rule.create({
    data: {
      shop,
      ...payload,
    },
  });
};

export const updateRule = async (id, shop, payload) => {
  // Check limit if enabling a rule
  if (payload.enabled === true) {
    const existingRule = await getRuleById(id, shop);
    // Only check if the rule is currently disabled
    if (existingRule && !existingRule.enabled) {
      await checkActiveRuleLimit(shop, id);
    }
  }

  return db.rule.updateMany({
    where: { id, shop },
    data: payload,
  });
};

export const deleteRule = (id, shop) => {
  return db.rule.deleteMany({
    where: { id, shop },
  });
};
