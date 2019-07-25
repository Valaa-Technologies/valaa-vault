// @flow
import { Readable } from "stream";

import { vRef } from "~/raem/VRL";
import VALEK from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

export type Term = (termType: string, value: any) => any;
export type TermOrNull = Term | null;

const baseUrn = "valos:id:";

export const dataTypes = {
  string: "http://www.w3.org/2001/XMLSchema#string",
  number: "http://www.w3.org/2001/XMLSchema#integer",
  boolean: "http://www.w3.org/2001/XMLSchema#boolean",
  null: "valos:null",
  object: "valos:object"
};

/**
 * Implements RDFJS source interface by wrapping Valker object
 * and converts the source interface match calls to VALK calls
 *
 * @export
 * @class CorpusQuadSource
 */
export class CorpusQuadSource {
  _engine = null

  constructor (engine) {
    this._engine = engine;
  }

  match (s?: TermOrNull, p?: TermOrNull, o?: TermOrNull, g?: TermOrNull) {
    const stream = new Readable({ objectMode: true });
    const self = this;

    try {
      const quad = _parseParametes(s, p, o, g);
      const hasSubject = (Object.keys(quad.s).length !== 0);
      const hasPredicate = (Object.keys(quad.p).length !== 0);
      const hasObject = (Object.keys(quad.o).length !== 0);

      if (hasSubject && hasPredicate && !hasObject) {
        const result = self._engine.run(vRef(quad.s.id), VALEK[quad.p.searchMethod](quad.p.id));
        _pushToStream(stream,
          [{ subject: s, predicate: p, object: _parseResponse(result), graph: g }]);
      } else if (hasSubject && hasPredicate && hasObject) {
        const result = self._engine.run(vRef(quad.s.id), VALEK[quad.p.searchMethod](quad.p.id));
        const parsedResult = _parseResponse(result);

        _pushToStream(stream, (_checkTermEquality(parsedResult, o)) ?
          [{ subject: s, predicate: p, object: o, graph: g }] : null
        );
      }

      return stream;
    } catch (e) {
      const errMsg = `Resource kuery failed: ${e.message}`;

      stream._read = () => {};
      stream.destroy(errMsg);
      return stream;
    }
  }
}

function _pushToStream (stream: Readable, data: any) {
  stream._read = () => {
    stream._read = () => {};

    if (Array.isArray(data) && data.length) {
      for (const obj of data) {
        stream.push(obj);
      }
    } else stream.push({});

    stream.push(null);
  };
}

function _parseParametes (s, p, o, g) {
  const quad = {
    s: (!s) ? {} : s,
    p: (!p) ? { termType: "NamedNode", } : p,
    o: (!o) ? {} : o,
    g: (!g) ? {} : g
  };

  for (const key in quad) {
    if (quad.hasOwnProperty(key)) {
      const term = quad[key];
      const iriMatch = term && term.value &&
        typeof term.value === "string" && term.value.match(/http:\/\/valospace.org\/(.*)/);

      if (iriMatch) {
        const suffix = iriMatch[1].split("#");
        term.id = suffix[1];

        switch (suffix[0]) {
          case "Property": term.searchMethod = "propertyValue"; break;
          default: break;
        }
      }

      quad[key] = term;
    }
  }

  return quad;
}

function _checkTermEquality (termA: Object, termB: Object) {
  if (termA.termType === "Literal" && termB === "Literal") {
    return (termA.datatype && termB.datatype
      && termA.datatype.termType === termB.datatype.termType
      && termA.datatype.value === termB.datatype.value);
  }

  return (termA.termType === termB.termType && termA.value === termB.value);
}

function _parseResponse (res: any) {
  if (res instanceof Vrapper) {
    return {
      termType: "NamedNode",
      value: `<${baseUrn + res.getRawId()}>`
    };
  }

  return {
    termType: "Literal",
    value: (res === null) ? "" :
      (typeof res === "object" && res !== null) ? JSON.stringify(res) : res,
    language: "",
    datatype: {
      termType: "NamedNode", value: dataTypes[(res === null) ? "null" : typeof res]
    }
  };
}
