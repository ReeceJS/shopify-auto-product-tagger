import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getProductById } from "../lib/products.server";
import { evaluateRulesForProduct } from "../lib/rules-engine.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const ruleId = url.searchParams.get("ruleId");

  if (!productId || !ruleId) {
    throw new Response(
      JSON.stringify({
        error: "Missing productId or ruleId query parameters",
        example: "/app/debug/test-rule?productId=10451306086712&ruleId=rule-456",
        alternateExample: "/app/debug/test-rule?productId=gid://shopify/Product/10451306086712&ruleId=rule-456",
        receivedProductId: productId,
        receivedRuleId: ruleId,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Convert numeric ID to gid format if needed
  let finalProductId = productId;
  if (!productId.startsWith("gid://")) {
    finalProductId = `gid://shopify/Product/${productId}`;
  }

  try {
    // Fetch the product
    console.log("Fetching product:", finalProductId);
    const product = await getProductById(admin, finalProductId);
    if (!product) {
      throw new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.log("Product fetched:", product.id, product.title);

    // Fetch the rule
    console.log("Fetching rule:", ruleId);
    const rule = await db.rule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      throw new Response(JSON.stringify({ error: "Rule not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.log("Rule fetched:", rule.id, rule.name);

    // Parse conditions and actions from JSON strings
    let parsedConditions = rule.conditions;
    let parsedActions = rule.actions;
    
    console.log("Raw conditions type:", typeof parsedConditions);
    console.log("Raw actions type:", typeof parsedActions);
    
    try {
      if (typeof parsedConditions === 'string') {
        parsedConditions = JSON.parse(parsedConditions);
      }
    } catch (e) {
      console.error("Failed to parse conditions:", e);
      parsedConditions = rule.conditions;
    }
    
    try {
      if (typeof parsedActions === 'string') {
        parsedActions = JSON.parse(parsedActions);
      }
    } catch (e) {
      console.error("Failed to parse actions:", e);
      parsedActions = rule.actions;
    }

    console.log("Parsed conditions:", parsedConditions);
    console.log("Parsed actions:", parsedActions);

    // Evaluate the rule with properly structured data
    console.log("Evaluating rule...");
    const ruleToEval = {
      ...rule,
      conditions: parsedConditions,
      actions: parsedActions,
    };

    const result = evaluateRulesForProduct(product, [ruleToEval]);
    console.log("Rule evaluation complete:", result);

    return {
      product: {
        id: product.id,
        title: product.title,
        variants: product.variants,
      },
      rule: {
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        conditions: parsedConditions,
        actions: parsedActions,
      },
      evaluationResult: result,
    };
  } catch (error) {
    console.error("Debug test error:", error);
    console.error("Error stack:", error.stack);
    throw new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
        type: error.constructor.name,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export default function DebugTestRule() {
  const data = useLoaderData();

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>Rule Debug Test</h1>
      <pre style={{ backgroundColor: "#f5f5f5", padding: "10px", overflow: "auto" }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
