/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";

// Limits to ensure rules run fast
const MAX_CONDITION_GROUPS = 5;
const MAX_CONDITIONS_PER_GROUP = 10;

const FIELD_OPTIONS = [
  { value: "vendor", label: "Vendor" },
  { value: "productType", label: "Product type" },
  { value: "title", label: "Title" },
  { value: "minVariantPrice", label: "Min variant price" },
  { value: "maxVariantPrice", label: "Max variant price" },
  { value: "weight", label: "Product weight" },
  { value: "status", label: "Status" },
  { value: "onSale", label: "On sale" },
  { value: "collection", label: "Collection handle" },
  { value: "inventoryQuantity", label: "Inventory quantity" },
];

const OPERATOR_OPTIONS_BY_FIELD = {
  vendor: [
    { value: "contains", label: "contains" },
    { value: "equals", label: "equals" },
  ],
  productType: [{ value: "equals", label: "equals" }],
  title: [{ value: "contains", label: "contains" }],
  minVariantPrice: [
    { value: "greater_than", label: "greater than" },
    { value: "greater_than_or_equal", label: "greater than or equal to" },
    { value: "less_than", label: "less than" },
    { value: "less_than_or_equal", label: "less than or equal to" },
    { value: "equals", label: "equals" },
  ],
  maxVariantPrice: [
    { value: "greater_than", label: "greater than" },
    { value: "greater_than_or_equal", label: "greater than or equal to" },
    { value: "less_than", label: "less than" },
    { value: "less_than_or_equal", label: "less than or equal to" },
    { value: "equals", label: "equals" },
  ],
  weight: [
    { value: "greater_than", label: "greater than" },
    { value: "greater_than_or_equal", label: "greater than or equal to" },
    { value: "less_than", label: "less than" },
    { value: "less_than_or_equal", label: "less than or equal to" },
    { value: "equals", label: "equals" },
  ],
  status: [{ value: "equals", label: "equals" }],
  onSale: [{ value: "equals", label: "is" }],
  collection: [
    { value: "contains", label: "contains" },
    { value: "equals", label: "equals" },
  ],
  inventoryQuantity: [
    { value: "greater_than", label: "greater than" },
    { value: "greater_than_or_equal", label: "greater than or equal to" },
    { value: "less_than", label: "less than" },
    { value: "less_than_or_equal", label: "less than or equal to" },
    { value: "equals", label: "equals" },
  ],
};
    { value: "less_than", label: "less than" },
    { value: "equals", label: "equals" },
  ],
};

const createCondition = () => ({
  field: "vendor",
  operator: "contains",
  value: "",
});

const createGroup = () => ({
  joiner: "AND",
  conditions: [createCondition()],
});

const createActionRow = () => ({
  type: "add",
  tagsText: "",
});

const parseJson = (value, fallback) => {
  try {
    if (!value) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeLegacyConditions = (conditions) => {
  if (!Array.isArray(conditions)) {
    return null;
  }

  return {
    groupJoiner: "AND",
    groups: [
      {
        joiner: "AND",
        conditions: conditions.length
          ? conditions.map((condition) => ({
              field: condition.field || "vendor",
              operator: condition.operator || "contains",
              value: String(condition.value || ""),
            }))
          : [createCondition()],
      },
    ],
  };
};

const normalizeGroupedConditions = (conditions) => {
  if (!conditions || typeof conditions !== "object" || !Array.isArray(conditions.groups)) {
    return null;
  }

  const groups = conditions.groups.map((group) => ({
    joiner: group.joiner === "OR" ? "OR" : "AND",
    conditions: Array.isArray(group.conditions) && group.conditions.length
      ? group.conditions.map((condition) => ({
          field: condition.field || "vendor",
          operator: condition.operator || "contains",
          value: String(condition.value || ""),
        }))
      : [createCondition()],
  }));

  return {
    groupJoiner: conditions.groupJoiner === "OR" ? "OR" : "AND",
    groups: groups.length ? groups : [createGroup()],
  };
};

const normalizeActions = (actions) => {
  if (actions?.items && Array.isArray(actions.items)) {
    const items = actions.items.map((item) => ({
      type: item.type === "remove" ? "remove" : "add",
      tagsText: Array.isArray(item.tags) ? item.tags.join(", ") : String(item.tagsText || ""),
    }));

    return { items: items.length ? items : [createActionRow()] };
  }

  const items = [];

  if (Array.isArray(actions?.addTags) && actions.addTags.length) {
    items.push({ type: "add", tagsText: actions.addTags.join(", ") });
  }

  if (Array.isArray(actions?.removeTags) && actions.removeTags.length) {
    items.push({ type: "remove", tagsText: actions.removeTags.join(", ") });
  }

  return {
    items: items.length ? items : [createActionRow()],
  };
};

const getConditionsConfig = (rule, conditionsConfigOverride) => {
  const parsedOverride = parseJson(conditionsConfigOverride, null);
  if (parsedOverride) {
    const grouped = normalizeGroupedConditions(parsedOverride);
    if (grouped) return grouped;
  }

  const grouped = normalizeGroupedConditions(rule?.conditions);
  if (grouped) return grouped;

  const legacy = normalizeLegacyConditions(rule?.conditions);
  if (legacy) return legacy;

  return {
    groupJoiner: "AND",
    groups: [createGroup()],
  };
};

const getActionsConfig = (rule, actionsConfigOverride) => {
  const parsedOverride = parseJson(actionsConfigOverride, null);
  if (parsedOverride) {
    return normalizeActions(parsedOverride);
  }

  return normalizeActions(rule?.actions || {});
};

export const getRuleFormDefaults = (rule, values) => {
  const name = values?.name ?? rule?.name ?? "";
  const description = values?.description ?? rule?.description ?? "";
  const enabledState = values?.enabledState ?? (rule?.enabled === false ? "disabled" : "enabled");
  const conditionsConfig = getConditionsConfig(rule, values?.conditionsConfig);
  const actionsConfig = getActionsConfig(rule, values?.actionsConfig);

  return {
    name,
    description,
    enabledState,
    conditionsConfig,
    actionsConfig,
  };
};

export function RuleFormFields({ defaults, componentKey }) {
  // State initialization happens once per mount (key prop forces remount)
  const [name, setName] = useState(defaults.name);
  const [description, setDescription] = useState(defaults.description);
  const [enabled, setEnabled] = useState(defaults.enabledState === "enabled");
  const [groups, setGroups] = useState(defaults.conditionsConfig.groups);
  const [groupJoiner, setGroupJoiner] = useState(defaults.conditionsConfig.groupJoiner);
  const [actionItems, setActionItems] = useState(defaults.actionsConfig.items);

  // Imperatively set select and text input values since web components don't respect value prop
  useEffect(() => {
    // Use a small timeout to ensure web components are ready
    const timer = setTimeout(() => {
      // Set text inputs
      const nameInput = document.querySelector('s-text-field[name="name"]');
      if (nameInput) {
        nameInput.value = name;
      }

      const descriptionInput = document.querySelector('s-text-area[name="description"]');
      if (descriptionInput) {
        descriptionInput.value = description;
      }

      // Set toggle
      const toggleInput = document.querySelector('s-toggle[name="enabledState"]');
      if (toggleInput) {
        toggleInput.checked = enabled;
      }

      // Set hidden input for form submission
      const hiddenInput = document.querySelector('input[type="hidden"][name="enabledState"]');
      if (hiddenInput) {
        hiddenInput.value = enabled ? "enabled" : "disabled";
      }

      // Set group-level joiner
      const groupJoinerEl = document.querySelector('[data-select="group-joiner"]');
      if (groupJoinerEl) {
        groupJoinerEl.value = groupJoiner;
      }

      // Set each group's joiner
      groups.forEach((group, groupIndex) => {
        const groupJoinerEl = document.querySelector(`[data-select="group-joiner"][data-index="${groupIndex}"]`);
        if (groupJoinerEl) {
          groupJoinerEl.value = group.joiner;
        }

        // Set each condition's field, operator, and value
        group.conditions.forEach((condition, conditionIndex) => {
          const fieldEl = document.querySelector(
            `[data-select="field"][data-group="${groupIndex}"][data-condition="${conditionIndex}"]`
          );
          const operatorEl = document.querySelector(
            `[data-select="operator"][data-group="${groupIndex}"][data-condition="${conditionIndex}"]`
          );
          const valueEl = document.querySelector(
            `[data-select="value"][data-group="${groupIndex}"][data-condition="${conditionIndex}"]`
          );
          const valueFieldEl = document.querySelector(
            `s-text-field[data-group="${groupIndex}"][data-condition="${conditionIndex}"]`
          );

          if (fieldEl) fieldEl.value = condition.field;
          if (operatorEl) operatorEl.value = condition.operator;
          if (valueEl) valueEl.value = condition.value;
          if (valueFieldEl) valueFieldEl.value = condition.value;
        });
      });

      // Set each action's type and tags
      actionItems.forEach((item, actionIndex) => {
        const typeEl = document.querySelector(`[data-select="action-type"][data-index="${actionIndex}"]`);
        if (typeEl) {
          typeEl.value = item.type;
        }

        const tagsEl = document.querySelector(
          `s-text-field[data-action-tags][data-index="${actionIndex}"]`
        );
        if (tagsEl) {
          tagsEl.value = item.tagsText;
        }
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [name, description, enabled, groupJoiner, groups, actionItems]);

  const serializedConditions = useMemo(
    () => JSON.stringify({ groupJoiner, groups }),
    [groupJoiner, groups],
  );

  const serializedActions = useMemo(
    () => JSON.stringify({ items: actionItems }),
    [actionItems],
  );

  const updateGroup = (groupIndex, updates) => {
    setGroups((current) =>
      current.map((group, index) =>
        index === groupIndex ? { ...group, ...updates } : group,
      ),
    );
  };

  const updateCondition = (groupIndex, conditionIndex, updates) => {
    setGroups((current) =>
      current.map((group, index) => {
        if (index !== groupIndex) {
          return group;
        }

        return {
          ...group,
          conditions: group.conditions.map((condition, idx) =>
            idx === conditionIndex ? { ...condition, ...updates } : condition,
          ),
        };
      }),
    );
  };

  const addConditionToGroup = (groupIndex) => {
    setGroups((current) => {
      const group = current[groupIndex];
      if (group && group.conditions.length >= MAX_CONDITIONS_PER_GROUP) {
        alert(`Maximum ${MAX_CONDITIONS_PER_GROUP} conditions per group allowed`);
        return current;
      }
      return current.map((group, index) =>
        index === groupIndex
          ? { ...group, conditions: [...group.conditions, createCondition()] }
          : group,
      );
    });
  };

  const removeConditionFromGroup = (groupIndex, conditionIndex) => {
    setGroups((current) =>
      current.map((group, index) => {
        if (index !== groupIndex) {
          return group;
        }

        const nextConditions = group.conditions.filter((_, idx) => idx !== conditionIndex);
        return {
          ...group,
          conditions: nextConditions.length ? nextConditions : [createCondition()],
        };
      }),
    );
  };

  const addGroup = () => {
    setGroups((current) => {
      if (current.length >= MAX_CONDITION_GROUPS) {
        alert(`Maximum ${MAX_CONDITION_GROUPS} condition groups allowed`);
        return current;
      }
      return [...current, createGroup()];
    });
  };

  const removeGroup = (groupIndex) => {
    setGroups((current) => {
      const next = current.filter((_, index) => index !== groupIndex);
      return next.length ? next : [createGroup()];
    });
  };

  const updateAction = (actionIndex, updates) => {
    setActionItems((current) =>
      current.map((item, index) => (index === actionIndex ? { ...item, ...updates } : item)),
    );
  };

  const addAction = () => {
    setActionItems((current) => [...current, createActionRow()]);
  };

  const removeAction = (actionIndex) => {
    setActionItems((current) => {
      const next = current.filter((_, index) => index !== actionIndex);
      return next.length ? next : [createActionRow()];
    });
  };

  return (
    <>
      <input type="hidden" name="conditionsConfig" value={serializedConditions} />
      <input type="hidden" name="actionsConfig" value={serializedActions} />

      <s-section>
        <s-stack direction="block" gap="base">
          <s-text-field 
            key={`name-${componentKey}`}
            name="name" 
            label="Rule name" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          ></s-text-field>

          <s-text-area
            key={`description-${componentKey}`}
            name="description"
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          ></s-text-area>

          <input type="hidden" name="enabledState" value="disabled" data-sync />
          <s-toggle
            key={`enabled-${componentKey}`}
            name="enabledState"
            label="Rule is active"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              // Sync the hidden input value for form submission
              const hiddenInput = e.target.parentElement.querySelector('input[name="enabledState"][data-sync]');
              if (hiddenInput) {
                hiddenInput.value = e.target.checked ? "enabled" : "disabled";
              }
            }}
            value="enabled"
          ></s-toggle>
        </s-stack>
      </s-section>

      <s-section heading="Conditions">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Create one or more groups. Conditions inside a group use that group&apos;s
            joiner, then groups are combined using the rule-level joiner. Maximum {MAX_CONDITION_GROUPS} groups
            with up to {MAX_CONDITIONS_PER_GROUP} conditions each.
          </s-paragraph>
          <div style={{ maxWidth: "320px" }}>
            <s-select
              key={`groupJoiner-${componentKey}`}
              data-select="group-joiner"
              label="Rule-level joiner (between groups)"
              value={groupJoiner}
              onChange={(event) => setGroupJoiner(event.currentTarget.value)}
            >
              <s-option value="AND">AND</s-option>
              <s-option value="OR">OR</s-option>
            </s-select>
          </div>

      <s-stack direction="block" gap="base">
        {groups.map((group, groupIndex) => (
          <s-box key={`group-${groupIndex}-${componentKey}`} padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-heading>Group {groupIndex + 1}</s-heading>

              <s-select
                key={`group-joiner-${groupIndex}-${componentKey}`}
                data-select="group-joiner"
                data-index={groupIndex}
                label="Group joiner (between conditions)"
                value={group.joiner}
                onChange={(event) => updateGroup(groupIndex, { joiner: event.currentTarget.value })}
              >
                <s-option value="AND">AND</s-option>
                <s-option value="OR">OR</s-option>
              </s-select>

              {group.conditions.map((condition, conditionIndex) => {
                const operatorOptions = OPERATOR_OPTIONS_BY_FIELD[condition.field] || OPERATOR_OPTIONS_BY_FIELD.vendor;

                return (
                  <s-box key={`condition-${groupIndex}-${conditionIndex}-${componentKey}`} padding="base" borderWidth="base" borderRadius="base" background="subdued">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr auto", gap: "12px", alignItems: "end" }}>
                      <s-select
                        key={`field-${groupIndex}-${conditionIndex}-${componentKey}`}
                        data-select="field"
                        data-group={groupIndex}
                        data-condition={conditionIndex}
                        label="Field"
                        value={condition.field}
                        onChange={(event) => {
                          const field = event.currentTarget.value;
                          const nextOperator = (OPERATOR_OPTIONS_BY_FIELD[field] || [])[0]?.value || "equals";
                          updateCondition(groupIndex, conditionIndex, {
                            field,
                            operator: nextOperator,
                          });
                        }}
                      >
                        {FIELD_OPTIONS.map((option) => (
                          <s-option key={option.value} value={option.value}>
                            {option.label}
                          </s-option>
                        ))}
                      </s-select>

                      <s-select
                        key={`operator-${groupIndex}-${conditionIndex}-${componentKey}`}
                        data-select="operator"
                        data-group={groupIndex}
                        data-condition={conditionIndex}
                        label="Operator"
                        value={condition.operator}
                        onChange={(event) =>
                          updateCondition(groupIndex, conditionIndex, {
                            operator: event.currentTarget.value,
                          })
                        }
                      >
                        {operatorOptions.map((option) => (
                          <s-option key={option.value} value={option.value}>
                            {option.label}
                          </s-option>
                        ))}
                      </s-select>

                      {condition.field === "status" ? (
                        <s-select
                          key={`value-${groupIndex}-${conditionIndex}-${componentKey}`}
                          data-select="value"
                          data-group={groupIndex}
                          data-condition={conditionIndex}
                          label="Value"
                          value={condition.value}
                          onChange={(event) =>
                            updateCondition(groupIndex, conditionIndex, {
                              value: event.currentTarget.value,
                            })
                          }
                        >
                          <s-option value="">Select status</s-option>
                          <s-option value="active">active</s-option>
                          <s-option value="draft">draft</s-option>
                          <s-option value="archived">archived</s-option>
                        </s-select>
                      ) : condition.field === "onSale" ? (
                        <s-select
                          key={`value-${groupIndex}-${conditionIndex}-${componentKey}`}
                          data-select="value"
                          data-group={groupIndex}
                          data-condition={conditionIndex}
                          label="Value"
                          value={condition.value}
                          onChange={(event) =>
                            updateCondition(groupIndex, conditionIndex, {
                              value: event.currentTarget.value,
                            })
                          }
                        >
                          <s-option value="">Select...</s-option>
                          <s-option value="true">true</s-option>
                          <s-option value="false">false</s-option>
                        </s-select>
                      ) : (
                        <s-text-field
                          key={`value-${groupIndex}-${conditionIndex}-${componentKey}`}
                          data-group={groupIndex}
                          data-condition={conditionIndex}
                          label="Value"
                          value={condition.value}
                          onChange={(event) =>
                            updateCondition(groupIndex, conditionIndex, {
                              value: event.currentTarget.value,
                            })
                          }
                        ></s-text-field>
                      )}

                      <s-button
                        type="button"
                        tone="critical"
                        onClick={() => removeConditionFromGroup(groupIndex, conditionIndex)}
                      >
                        Remove
                      </s-button>
                    </div>
                  </s-box>
                );
              })}

              <s-stack direction="inline" gap="base">
                <s-button type="button" onClick={() => addConditionToGroup(groupIndex)}>
                  Add condition
                </s-button>
                <s-button type="button" tone="critical" onClick={() => removeGroup(groupIndex)}>
                  Remove group
                </s-button>
              </s-stack>
            </s-stack>
          </s-box>
        ))}

          <s-button type="button" onClick={addGroup}>Add group</s-button>
        </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Actions">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Add one or more actions. Each action can add or remove the
            comma-separated tags you enter.
          </s-paragraph>
          {actionItems.map((item, actionIndex) => (
            <s-box key={`action-${actionIndex}-${componentKey}`} padding="base" borderWidth="base" borderRadius="base" background="subdued">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr auto", gap: "12px", alignItems: "end" }}>
                <s-select
                  key={`action-type-${actionIndex}-${componentKey}`}
                  data-select="action-type"
                  data-index={actionIndex}
                  label="Action"
                  value={item.type}
                onChange={(event) =>
                  updateAction(actionIndex, {
                    type: event.currentTarget.value,
                  })
                }
              >
                <s-option value="add">Add these tag(s)</s-option>
                <s-option value="remove">Remove these tag(s)</s-option>
              </s-select>

              <s-text-field
                key={`action-tags-${actionIndex}-${componentKey}`}
                data-action-tags
                data-index={actionIndex}
                label="Tags (comma-separated)"
                value={item.tagsText}
                onChange={(event) =>
                  updateAction(actionIndex, {
                    tagsText: event.currentTarget.value,
                  })
                }
              ></s-text-field>

              <s-button type="button" tone="critical" onClick={() => removeAction(actionIndex)}>
                Remove
              </s-button>
            </div>
          </s-box>
        ))}

          <s-button type="button" onClick={addAction}>Add tag action</s-button>
        </s-stack>
      </s-section>
    </>
  );
}
