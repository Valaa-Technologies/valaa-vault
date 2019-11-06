// @flow

const FieldSchemaTag = Symbol("FieldSchema");

export function _filterResults (mapper, results, filter, ids, fieldRequirements) {
  const idLookup = ids
      && ids.split(",").reduce((lookup, id) => (lookup[id] = true) && lookup, {});
  let requirementCount = 0;
  const requiredFields = [];
  Object.entries(fieldRequirements).forEach(([fieldName, requirements]) => {
    if (!requirements) return;
    const requireFieldName = (fieldName.match(/require-(.*)/) || [])[1];
    if (!requireFieldName) return;
    const requiredIds = {};
    requirements.split(",").forEach(targetId => {
      const condition = true; // This can have a more elaborate condition in the future
      if (requiredIds[targetId]) {
        if (requiredIds[targetId] === condition) return; // just ignore duplicates
        throw new Error(`Complex compount field requirements for ${fieldName}=${targetId
            } are not implemented, {${condition}} requested, {${requiredIds[targetId]}
            } already exists`);
      }
      requiredIds[targetId] = condition;
      ++requirementCount;
    });
    requiredFields.push([requireFieldName, requiredIds]);
  });
  return results.filter(result => {
    if (result == null) return false;
    // TODO(iridian, 2019-02): This is O(n) where n is the number
    // of all matching route resources in corpus befor filtering,
    // not the number of requested resources. Improve.
    if (idLookup && !idLookup[(result.$V || {}).id]) return false;

    let satisfiedRequirements = 0;
    for (const [fieldName, requiredIds] of requiredFields) {
      const remainingRequiredIds = Object.create(requiredIds);
      for (const sequenceEntry of (result[fieldName] || [])) {
        const currentHref = ((sequenceEntry || {}).$V || {}).href;
        const currentId = currentHref && (currentHref.match(/\/([a-zA-Z0-9\-_.~]+)$/) || [])[1];
        // Check for more elaborate condition here in the future
        if (remainingRequiredIds[currentId]) {
          // Prevent multiple relations with same target from
          // incrementing satisfiedRequirements
          remainingRequiredIds[currentId] = false;
          ++satisfiedRequirements;
        }
      }
    }
    return satisfiedRequirements === requirementCount;
  });
}

export function _sortResults (mapper, results, sort) {
  const sortKeys = sort.split(",");
  const order = sortKeys.map((key, index) => {
    if (key[0] !== "-") return 1;
    sortKeys[index] = key.slice(1);
    return -1;
  });
  results.sort((l, r) => {
    for (let i = 0; i !== sortKeys.length; ++i) {
      const key = sortKeys[i];
      if (l[key] === r[key]) continue;
      return ((l[key] < r[key]) ? -1 : 1) * order[i];
    }
    return 0;
  });
  return results;
}

export function _paginateResults (mapper, results, offset, limit) {
  return results.slice(offset || 0, limit && ((offset || 0) + limit));
}

export function _pickResultFields (mapper, rootResult, fields /* , resultSchema */) {
  const selectors = { [FieldSchemaTag]: false };
  fields.split(",").forEach(field => {
    const steps = field.split("/");
    const isInject = steps[steps.length - 1] === "*";
    if (isInject) steps.splice(-1);
    const fieldSelector = steps.reduce(
        (nesting, step) => nesting[step] || (nesting[step] = { [FieldSchemaTag]: false }),
        selectors,
    );
    fieldSelector[FieldSchemaTag] = !isInject ? true
        : {}; /* : steps.reduce((subSchema, step, index) => {
      let returning;
      for (let current = subSchema; ;) {
        if (typeof current === "string") current = _derefSchema(mapper, current);
        else if (current.type === "array") current = current.items;
        else if (returning) return current;
        else if (current.type !== "object") {
          throw new Error(`Can't access field '${step}' (fields JSON pointer ${
            JSON.stringify(field)} step #${index}) from non-object schema ${current.type}`);
        } else {
          current = current.properties[step];
          if (!current) {
            throw new Error(`Can't find field '${step}' (fields JSON pointer ${
                JSON.stringify(field)} step #${index}) from object schema properties`);
          }
          returning = true;
        }
      }
    }, resultSchema);
    */
  });
  const injects = [];
  const _pickFields = (result, selector) => {
    if (!result || (typeof result !== "object")) return;
    if (Array.isArray(result)) {
      for (const entry of result) _pickFields(entry, selector);
      return;
    }
    const fieldSchema = selector[FieldSchemaTag];
    const V = result.$V;
    for (const [key, value] of Object.entries(result)) {
      const subSelector = selector[key];
      if (subSelector) _pickFields(value, subSelector);
      else if ((fieldSchema === false) && (key !== "$V")) delete result[key];
    }
    if (((V || {}).rel === "self")
        && ((fieldSchema && (fieldSchema !== true)) || Object.keys(selector).length)) {
      // So this is not exactly kosher. To implement expansion of
      // nested properties we make virtual GET requests using the
      // projection API which is primarily intended for testing and
      // incurs full request overheads for each call. On the other
      // hand, this is simple, complete and way more efficient than
      // having clients make separate queries for the entries.
      const subFields = _gatherSubFields(selector).join(",");
      injects.push(
        mapper.getRootFastify().inject({
          method: "GET",
          url: V.href,
          query: { fields: subFields },
        }).then(response => {
          if (response.statusCode === 200) {
            V.target = JSON.parse(response.payload);
          } else {
            V.expansion = { statusCode: response.statusCode, payload: response.payload };
          }
          result.$V = V;
        }).catch(error => {
          V.expansion = { statusCode: 500, payload: error.message };
          result.$V = V;
        }),
      );
    }
  };
  _pickFields(rootResult, selectors);
  if (!injects.length) return rootResult;
  return Promise.all(injects).then(() => rootResult);
  function _gatherSubFields (selector, currentPath = "", subFields = []) {
    if (selector[FieldSchemaTag]) {
      subFields.push((selector[FieldSchemaTag] === true) ? currentPath
          : !currentPath ? "*"
          : `${currentPath}/*`);
    }
    Object.entries(selector).forEach(([key, subSelector]) =>
        _gatherSubFields(subSelector, `${currentPath ? `${currentPath}/` : ""}${key}`,
            subFields));
    return subFields;
  }
}
