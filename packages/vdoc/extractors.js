const _extractionRuleRegex = /([^#]*)#(([0-9]+)|([^>;]+))?(>([0-9]+)|([^;]*))?(;(.*))?/;

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
      if (rule.range) node["@type"] = rule.range;
      if ((typeof patch !== "object") || (patch === null)) {
        if (!resourceId && !Object.keys(node).length) {
          node = patch;
        } else {
          _extendRuleBodyWithArrayPatch(this, node, rule, [patch]);
        }
      } else if (Array.isArray(patch)) {
        if (!rule.owner || (!resourceId && !Object.keys(node).length)) {
          node = this.extend([], patch);
          if (resourceId) this.documentNode[resourceId] = node;
        } else {
          _extendRuleBodyWithArrayPatch(this, node, rule, patch);
        }
      } else {
        node["vdoc:pre_body"] = rule.body;
        this.extend(node, patch);
        delete node["vdoc:pre_body"];
      }
      if (rule.owner) {
        const preOwnees = (targetObject["vdoc:pre_ownees"]
            || (targetObject["vdoc:pre_ownees"] = {}));
        (preOwnees[rule.owner] || (preOwnees[rule.owner] = [])).push([
          (orderId && `${orderId}\uFFFF`) || (orderElement && (Number(orderElement) + 0.5))
              || resourceId || (elementId && Number(elementId)),
          resourceId ? { "@id": resourceId } : node,
        ]);
      }
      return this.returnUndefined;
    },
    postExtend (target) {
      if ((target == null) || (target === this.returnUndefined)) return target;
      const unorderedOwnees = target["vdoc:pre_ownees"];
      if (unorderedOwnees) {
        for (const [owningProperty, ownees] of Object.entries(unorderedOwnees)) {
          target[target["vdoc:pre_body"] || owningProperty] =
              [].concat(...ownees.sort(_compareWithOrderQualifier).map(e => e[1]));
        }
        delete target["vdoc:pre_ownees"];
      }
      return target;
    },
  },
};

function _extendRuleBodyWithArrayPatch (extender, node, rule, arrayPatch) {
  node[rule.body] = extender.extend([], arrayPatch);
  if (rule.body === "vdoc:content") {
    node[rule.body] = _splitNewlineWhitespaceSections(node[rule.body]);
  } else if (rule.body === "vdoc:entries") {
    node[rule.body] = node[rule.body].map(_splitNewlineWhitespaceSections);
  }
}

function _splitNewlineWhitespaceSections (value = []) {
  return [].concat(...[].concat(value)
      .map(e => ((typeof e !== "string")
          ? [e]
          : e.split(/\n\s*(\n)/).map((se, i) => (i % 2 ? null : se)))));
}

function _compareWithOrderQualifier (l, r) {
  return (l[0] < r[0]) ? -1 : (l[0] > r[0]) ? 1 : 0;
}
