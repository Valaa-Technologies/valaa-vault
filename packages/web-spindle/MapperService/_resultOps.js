// @flow

import { JSDOM } from "jsdom";
import React from "react";
import ReactDOM from "react-dom";
import { Readable, Transform, Duplex } from "stream";

import ReactRoot from "~/inspire/ui/ReactRoot";

import Vrapper from "~/engine/Vrapper";

import { dumpObject, thenChainEagerly } from "~/tools";

const FieldSchemaTag = Symbol("FieldSchema");

export function _filterResults (router, results, filter, ids, fieldRequirements) {
  const idLookup = ids
      && ids.split(",").reduce((lookup, id) => (lookup[id] = true) && lookup, {});
  let requirementCount = 0;
  const requiredValuesByField = [];
  Object.entries(fieldRequirements).forEach(([fieldName, requirements]) => {
    const requireFieldName = (fieldName.match(/^require-(.*)$/) || [])[1];
    if (!requireFieldName) {
      const excludeFieldName = (fieldName.match(/^exclude-(.*)$/) || [])[1];
      if (excludeFieldName) {
        requiredValuesByField.push([requireFieldName, false]);
      }
    }
    if (!requirements) {
      // require any truthy.
      ++requirementCount;
      requiredValuesByField.push([requireFieldName, true]);
      return;
    }
    const requiredValues = {};
    requirements.split(",").forEach(requiredValue => {
      const condition = true; // This can have a more elaborate condition in the future
      const needleValue = requiredValue === "";
      if (requiredValues[needleValue]) {
        if (requiredValues[needleValue] === condition) return; // just ignore duplicates
        throw new Error(`Complex compount field requirements for ${fieldName}=${needleValue
            } are not implemented, {${condition}} requested, {${requiredValues[needleValue]}
            } already exists`);
      }
      requiredValues[needleValue] = condition;
      ++requirementCount;
    });
    requiredValuesByField.push([requireFieldName, requiredValues]);
  });
  return results.filter(result => {
    if (result == null) return false;
    // TODO(iridian, 2019-02): This is O(n) where n is the number
    // of all matching route resources in corpus befor filtering,
    // not the number of requested resources. Improve.
    if (idLookup && !idLookup[(result.$V || {}).id]) return false;
    let satisfiedRequirements = 0;
    for (const [fieldName, requiredValues] of requiredValuesByField) {
      const resultField = result[fieldName];
      if (resultField === undefined) return false;
      if (typeof requiredValues === "boolean") {
        if (!!resultField === requiredValues) ++satisfiedRequirements;
        continue;
      }
      const remainingRequiredValues = Object.create(requiredValues);
      for (const resultEntry of (Array.isArray(resultField) ? resultField : [resultField])) {
        let needleValue = resultEntry;
        if (resultEntry && (typeof resultEntry === "object")) {
          const needleHRef = (resultEntry.$V || {}).href;
          needleValue = needleHRef && (needleHRef.match(/\/([a-zA-Z0-9\-_.~]+)$/) || [])[1];
        }
        // Check for more elaborate condition here in the future
        if (remainingRequiredValues[needleValue]) {
          // Prevent multiple relations with same target from
          // incrementing satisfiedRequirements
          remainingRequiredValues[needleValue] = false;
          ++satisfiedRequirements;
        }
      }
    }
    return satisfiedRequirements === requirementCount;
  });
}

export function _sortResults (router, results, sort) {
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

export function _paginateResults (router, results, offset, limit) {
  return results.slice(offset || 0, limit && ((offset || 0) + limit));
}

export function _pickResultFields (router, valkOptions, rootResult, fields/* , resultSchema */) {
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
        if (typeof current === "string") current = _derefSchema(router, current);
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
  const pendingRelRequests = [];
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
    if (((V || {}).rel)
        && ((fieldSchema && (fieldSchema !== true)) || Object.keys(selector).length)) {
      const subFields = _gatherSubFields(selector).join(",");
      const relRequestProcess = thenChainEagerly({
        method: "GET",
        url: V.href,
        query: { fields: subFields },
        cookies: valkOptions.scope.request.cookies,
      }, [
        requestOptions => router.relRequest(V.rel, requestOptions),
        (response) => {
          if (response.statusCode === 200) {
            V.target = response.payloadJSON || JSON.parse(response.payload);
          } else {
            V.expansion = { statusCode: response.statusCode, payload: response.payload };
          }
          result.$V = V;
        }
      ],
      error => {
        V.expansion = { statusCode: 500, payload: error.message };
        result.$V = V;
      });
      if (relRequestProcess) pendingRelRequests.push(relRequestProcess);
    }
  };
  _pickFields(rootResult, selectors);
  if (!pendingRelRequests.length) return rootResult;
  return Promise.all(pendingRelRequests).then(() => rootResult);
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

export function _fillReplyFromResponse (router, responseContent, runtime, valkOptions) {
  const scope = valkOptions.scope;
  const reply = scope.reply;
  if (reply.sent) return true;

  let sendContent;

  if (runtime.resourceHRef) {
    const relResponse = { $V: {
      rel: "self", href: runtime.resourceHRef(responseContent, scope),
    } };
    if (runtime.targetHRef) {
      relResponse.$V.target = { $V: {
        rel: "self", href: runtime.targetHRef(responseContent[2], scope),
      } };
    }
    return _fillReplyFromResponse(router, relResponse, {}, valkOptions);
  }
  if (reply.sendLoopbackContent) {
    reply.sendLoopbackContent(responseContent);
    return true;
  }
  if ((responseContent == null) || (typeof responseContent !== "object")) {
    sendContent = responseContent;
  } else if (Object.getPrototypeOf(responseContent) === Object.prototype
      || Array.isArray(responseContent)) {
    sendContent = JSON.stringify(responseContent, null, 2);
  } else if (responseContent instanceof Vrapper) {
    const resourceTypeName = responseContent.getTypeName();
    switch (resourceTypeName) {
      case "Media":
        return _fillReplyFromMedia(router, responseContent, runtime, valkOptions, reply);
      case "Entity":
      case "Relation":
        return _fillReplyFromWebLens(router, responseContent, runtime, valkOptions);
      default:
    }
    throw new Error(`Unrecognized response resource type: ${resourceTypeName}`);
  } else if (Buffer.isBuffer(responseContent)) {
    sendContent = responseContent;
  } else if (responseContent instanceof ArrayBuffer) {
    sendContent = Buffer.from(responseContent);
  } else if (ArrayBuffer.isView(responseContent)) {
    sendContent = Buffer.from(responseContent.buffer);
  } else if (responseContent instanceof Readable
      || responseContent instanceof Transform
      || responseContent instanceof Duplex) {
    sendContent = responseContent;
  } else if (responseContent.outerHTML !== undefined) {
    reply.header("content-type", "text/html");
    sendContent = `<!DOCTYPE html>${responseContent.outerHTML}`;
  } else if (responseContent.body !== undefined) {
    // A proxied fetch response
    // TODO(iridian, 2019-12): Handle/forward all other response fields
    // such as redirections, cookies etc.
    reply.code(responseContent.status);
    for (const entry of (responseContent.headers || [])) {
      if (!reply.getHeader(entry[0])) reply.header(...entry);
    }
    return _fillReplyFromResponse(router, responseContent.body, runtime, valkOptions);
/*
  } else if (responseContent instanceof ReadableStream) {
    _fillReplyWithReadableStream(reply, responseContent);
  } else if (responseContent instanceof Blob) {
    _fillReplyWithReadableStream(reply, responseContent.stream());
*/
  } else {
    throw new Error(`Unrecognized complex response object of type ${
      (responseContent.constructor || {}).name || "<constructor missing>"}`);
  }
  if (!reply.statusCode) reply.code(200);
  if (sendContent !== undefined) reply.send(sendContent);
  router.infoEvent(2, () => [
    `${router.name}:`, ...dumpObject(scope.resource),
    "\n\tresponseContent:", ...dumpObject(responseContent),
  ]);
  return true;
}

function _fillReplyFromMedia (router, vMedia, runtime, valkOptions, reply) {
  const mediaInfo = vMedia.resolveMediaInfo(Object.create(valkOptions));
  if (!mediaInfo.contentHash && mediaInfo.sourceURL) {
    reply.redirect(mediaInfo.sourceURL);
    return true;
  }
  reply.header("content-type", mediaInfo.contentType);
  reply.header("content-disposition", `filename="${mediaInfo.name}"`);
  return thenChainEagerly(vMedia.getConnection(), [
    connection =>
        connection.decodeMediaContent({ ...mediaInfo, contentType: "application/octet-stream" }),
    mediaContent =>
        _fillReplyFromResponse(router, mediaContent, runtime, valkOptions),
  ]);
}

function _fillReplyFromWebLens (router, vFocus, runtime, valkOptions) {
  const lens = vFocus.get(["§..", "WEB_LENS"], Object.create(valkOptions));
  if (!lens) {
    throw new Error(`No lens property 'WEB_LENS' found from response resource type: ${
      vFocus.getTypeName(valkOptions)}`);
  }
  const scope = valkOptions.scope;
  const name = String(scope.request.raw.url || "").split("?")[0];
  for (const [queryKey, queryValue] of Object.entries(scope.request.query || {})) {
    scope[queryKey] = queryValue;
  }
  const resultElement = (new JSDOM(`<!DOCTYPE html>`)).window.document.documentElement;
  const reactRoot = (
    <ReactRoot
      isHTMLRoot
      viewName={name}
      vViewFocus={vFocus}
      lensProperty="WEB_LENS"
      uiScope={scope}
    />
  );
  return new Promise(resolve => {
    ReactDOM.render(reactRoot, resultElement, () => {
      setTimeout(
          () => resolve(_fillReplyFromResponse(router, resultElement, runtime, valkOptions)),
          200);
    });
  });
}
