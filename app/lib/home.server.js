import { getActiveRuleCount, getRulesForShop } from "./rules.server";
import { getLatestRun } from "./bulk-run.server";

const RULE_LIMIT = 50;

/**
 * Get home page status data
 * Returns aggregated status information for the dashboard
 */
export const getHomePageStatus = async (shop) => {
  const [activeRuleCount, latestRun] = await Promise.all([
    getActiveRuleCount(shop),
    getLatestRun(shop),
  ]);

  return {
    automationActive: activeRuleCount > 0,
    activeRuleCount,
    ruleLimit: RULE_LIMIT,
    webhookConnected: true, // Webhooks are configured in shopify.app.toml
    lastExecutionAt: latestRun?.updatedAt || null,
  };
};

/**
 * Get snapshot of recent rules for the dashboard
 * Returns up to 5 most recent rules with minimal data
 */
export const getRecentRulesSnapshot = async (shop, limit = 5) => {
  const rules = await getRulesForShop(shop, {
    sortBy: "created_desc",
    filterStatus: "all",
  });

  return rules.slice(0, limit).map((rule) => {
    // Count conditions
    const conditionCount = Array.isArray(rule.conditions?.groups)
      ? rule.conditions.groups.reduce(
          (sum, group) => sum + (group.conditions?.length || 0),
          0
        )
      : Array.isArray(rule.conditions)
        ? rule.conditions.length
        : 0;

    // Count tags
    const tagCount = Array.isArray(rule.actions?.items)
      ? rule.actions.items.reduce((sum, item) => sum + (item.tags?.length || 0), 0)
      : (rule.actions?.addTags?.length || 0) + (rule.actions?.removeTags?.length || 0);

    return {
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      conditionCount,
      tagCount,
    };
  });
};

/**
 * Get computed home page data
 * Combines status and rules snapshot
 */
export const getHomePageData = async (shop) => {
  const [status, recentRules] = await Promise.all([
    getHomePageStatus(shop),
    getRecentRulesSnapshot(shop),
  ]);

  return {
    status,
    recentRules,
    hasRules: recentRules.length > 0,
  };
};
