module.exports = {
  native: {
    preExtend (target, patch, key, targetObject /* , patchObject */) {
      if (typeof key !== "string") return undefined;
      const [match, ruleName,, elementId, resourceId,, orderElement, orderId,, rest] =
          key.match(_extractionRuleRegex) || [];
      if (!match) return undefined;
      const rule = this.extractionRules[ruleName];
      if (!rule) return undefined;
      let node = (resourceId === undefined) ? {}
          : (this.documentNode[resourceId]
              || (this.documentNode[resourceId] = { "@id": resourceId }));
      if (rest !== undefined) {
        if (!rule.rest) {
          throw new Error(`Rule '${ruleName}' doesn't specify 'rest' but '${rest}' was found`);
        }
        if (node[rule.rest] !== undefined) {
          throw new Error(`Node #${resourceId || elementId} already has '${rule.rest}': ${
            JSON.stringify(node[rule.rest])}`);
        }
        node[rule.rest] = rest;
      }
      if (rule.range) node["rdf:type"] = rule.range;
      if ((typeof patch !== "object") || (patch === null)) {
        if (!resourceId && !Object.keys(node).length) {
          node = patch;
        } else {
          node[rule.target] = this.extend([], [patch]);
        }
      } else if (Array.isArray(patch)) {
        if (rule.hidden || (!resourceId && !Object.keys(node).length)) {
          node = this.extend([], patch);
          if (resourceId) this.documentNode[resourceId] = node;
        } else {
          node[rule.target] = this.extend([], patch);
        }
      } else {
        node["vdoc:pre_target"] = rule.target;
        this.extend(node, patch);
        delete node["vdoc:pre_target"];
      }
      if (!rule.hidden) {
        (targetObject["vdoc:pre_content"] || (targetObject["vdoc:pre_content"] = [])).push([
          (orderId && `${orderId}\uFFFF`) || (orderElement && (Number(orderElement) + 0.5))
              || resourceId || (elementId && Number(elementId)),
          resourceId ? { "@id": resourceId } : node,
        ]);
      }
      return this.returnUndefined;
    },
    postExtend (target) {
      if ((target == null) || (target === this.returnUndefined)) return target;
      const unorderedEntries = target["vdoc:pre_content"];
      if (unorderedEntries) {
        target[target["vdoc:pre_target"] || "vdoc:content"] = []
            .concat(...unorderedEntries.sort(_compareWithOrderQualifier).map(e => e[1]));
        delete target["vdoc:pre_content"];
      }
      return target;
    },
  },
};

const _extractionRuleRegex = /([^#]*)#(([0-9]+)|([^#>;]+))?(>([0-9]+)|([^#>;]*))?(;([^#>;]*))?/;

function _compareWithOrderQualifier (l, r) {
  return (l[0] < r[0]) ? -1 : (l[0] > r[0]) ? 1 : 0;
}
