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
      if (Array.isArray(patch)) {
        if (!rule.owner || (!resourceId && !Object.keys(node).length)) {
          // console.log("array-split:", ruleName, key);
          node = _splitNewlineWhitespaceSections(this.extend([], patch), rule.paragraphize);
          if (resourceId) this.documentNode[resourceId] = node;
        } else {
          // console.log("array-extend:", ruleName, key);
          node[rule.body] = _extendWithArrayPatch(this, rule, patch);
        }
      } else if ((typeof patch !== "object") || (patch === null) || patch["@type"]) {
        if (!resourceId && !Object.keys(node).length) {
          // console.log("singular-split:", ruleName, key);
          node = (typeof patch !== "string")
              ? patch
              : _splitNewlineWhitespaceSections(patch, rule.paragraphize);
        } else {
          // console.log("singular-extend:", ruleName, key, JSON.stringify(rule, null, 0));
          node[rule.body] = _extendWithArrayPatch(this, rule, [patch]);
        }
      } else {
        // console.log("pre-post-process:", ruleName, key);
        node["VDoc:pre_body"] = rule.body;
        this.extend(node, patch);
        delete node["VDoc:pre_body"];
      }
      if (rule.owner) {
        const preOwnees = (targetObject["VDoc:pre_ownees"]
            || (targetObject["VDoc:pre_ownees"] = {}));
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
      const unorderedOwnees = target["VDoc:pre_ownees"];
      if (unorderedOwnees) {
        for (const [owningProperty, ownees] of Object.entries(unorderedOwnees)) {
          target[target["VDoc:pre_body"] || owningProperty] =
              [].concat(...ownees.sort(_compareWithOrderQualifier).map(e => e[1]));
        }
        delete target["VDoc:pre_ownees"];
      }
      return target;
    },
  },
};

function _extendWithArrayPatch (extender, rule, arrayPatch) {
  const ret = extender.extend([], arrayPatch);
  if (rule.body === "VDoc:content") {
    const body = _splitNewlineWhitespaceSections(ret, rule.paragraphize);
    const onlyEntry = !Array.isArray(body) ? body : (body.length === 1) ? body[0] : undefined;
    return [].concat(
        (onlyEntry || {})["VDoc:content"] && (Object.keys(onlyEntry).length === 1)
            ? onlyEntry["VDoc:content"]
            : body);
  }
  if (rule.body === "VDoc:entries") {
    return ret.map(_splitNewlineWhitespaceSections, rule.paragraphize);
  }
  return ret;
}

function _splitNewlineWhitespaceSections (values = [], alwaysParagraphize) {
  const result = [];
  let currentParagraph = [];
  for (const value of [].concat(values)) {
    if (value === null) {
      flushCurrent();
    } else if (typeof value !== "string") {
      currentParagraph.push(value);
    } else {
      value.split(/\n\s*(\n)/).forEach(bubbleOnDoubleNewline);
    }
  }
  if (!result.length && !alwaysParagraphize) return currentParagraph;
  flushCurrent();
  return (result.length !== 1) ? result : result[0];
  function flushCurrent () {
    if (currentParagraph.length) {
      result.push({
        "@type": "VDoc:Paragraph",
        "VDoc:content": currentParagraph,
      });
      currentParagraph = [];
    }
  }
  function bubbleOnDoubleNewline (e, i) {
    if (!(i % 2)) {
      if (e) currentParagraph.push(e);
    } else if (currentParagraph.length) {
      flushCurrent();
    }
  }
}

function _compareWithOrderQualifier (l, r) {
  return (l[0] < r[0]) ? -1 : (l[0] > r[0]) ? 1 : 0;
}
