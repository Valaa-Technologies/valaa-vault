// @flow

const Readable = require("stream").Readable;

const vRef = require("~/raem/VRL").vRef;
const VALEK = require("~/engine/VALEK").default;
const Vrapper = require("~/engine/Vrapper").default;
const Datafactory = require("./CorpusQuadDatafactory.js").default;

const baseIdUrn = "valos:id:";

const dataTypes = {
  string: "http://www.w3.org/2001/XMLSchema#string",
  number: "http://www.w3.org/2001/XMLSchema#integer",
  boolean: "http://www.w3.org/2001/XMLSchema#boolean",
  null: "valos:null",
  object: "valos:object"
};

/**
 * Converts the source interface match calls to VALK calls
 *
 * @export
 * @class CorpusQuadSource
 */
class CorpusQuadSource {
  _context = {}
  querySessionSymbol = Symbol("_querySession")

  constructor (engine) {
    this.engine = engine;
    this._context[this.querySessionSymbol] = { variables: {} };
  }

  match (s?: any, p?: any, o?: any, g?: any, context?: any) {
    const stream = new Readable({ objectMode: true });
    const self = this;

    if (context) {
      for (const key in context) {
        if (context.hasOwnProperty(key)) self._context[key] = context[key];
      }
    }

    try {
      const quad = {
        s: _getInitialTermValue(s, self, "subject"),
        p: _getInitialTermValue(p, self, "predicate"),
        o: _getInitialTermValue(o, self, "object")
      };

      const hasSubject = ((quad.s.value !== undefined && quad.s.value !== null)
        || (Array.isArray(quad.s.data) && quad.s.data.length !== 0));
      const hasPredicate = (quad.p.value !== undefined && quad.p.value !== null);
      const hasObject = (quad.o.value !== undefined && quad.o.value !== null);

      if (hasSubject && hasPredicate && hasObject) {
        const result = _kueryEngine(self.engine, quad.s.id, quad.p.kuery);

        if (result && Array.isArray(result)) {
          let isMatch = false;
          for (let i = 0; i < result.length; i++) {
            const match = o.value.match(/<valos:id:(.*)/);
            if (result[i].getRawId() === match[1].slice(0, match[1].length - 1)) {
              _pushToStream(stream, [_createQuad(s, p, o)]);
              isMatch = true;
              break;
            }
          }
          if (!isMatch) _pushToStream(stream, null);
        } else {
          _pushToStream(stream, (_parseResponse(result).equals(o)) ?
            [_createQuad(s, p, o)] : null
          );
        }
      } else if (hasSubject && hasPredicate && !hasObject) {
        let result = [];

        if (Array.isArray(quad.s.data) && quad.s.data.length !== 0) {
          for (const subject of quad.s.data) {
            result.push({
              s: Datafactory.namedNode(`<${baseIdUrn + subject.id}>`),
              o: _kueryEngine(self.engine, subject.id, quad.p.kuery),
            });
          }
        } else {
          const engineResult = _kueryEngine(self.engine, quad.s.id, quad.p.kuery);
          if (Array.isArray(engineResult)) {
            result = engineResult.map((res) => ({ o: res }));
          } else result.push({ o: engineResult });
        }

        const quads = [];

        if (quad.p.filterType) {
          result = result.filter((res) => {
            const entry = res.o;
            if (!(entry instanceof Vrapper)) return true;

            return (entry.getTypeName().toLowerCase()
              === quad.p.filterType.toLowerCase());
          });
        }

        for (let i = 0; i < result.length; i++) {
          const res = result[i];
          const resultObj = _parseResponse(res.o, quad.o, self._context[self.querySessionSymbol]);
          quads.push((resultObj) ?
            _createQuad((res.s) ? res.s : s, p, resultObj) : null);
        }
        _pushToStream(stream, quads);
      } else {
        _pushToStream(stream, null);
      }

      return stream;
    } catch (e) {
      console.log("ErrMsg ", e.message);
      stream._read = () => {};
      stream.destroy(e.message);
      return stream;
    }
  }
}

function _kueryEngine (engine, id, kuery) {
  if (engine && id && kuery) {
    try {
      return engine.run(vRef(id), kuery);
    } catch (e) {
      console.log("error: ", e.message);
    }
  }

  return undefined;
}

function _createQuad (s, p, o) {
  return Datafactory.quad(
    Datafactory.namedNode(s.value), Datafactory.namedNode(p.value),
    o, Datafactory.defaultGraph());
}

// Sets stream._read to empty function after
// first run to avoid data being pushed multiple times to the stream
function _pushToStream (stream: Readable, data: any) {
  stream._read = () => {
    stream._read = () => {};

    if (Array.isArray(data) && data.length) {
      for (const obj of data) {
        if (obj) stream.push(obj);
      }
    }

    stream.push(null);
  };
}

function _parseResponse (result: any, term: Object, session: any) {
  if (!result) return undefined;

  if (result instanceof Vrapper || (result.reference && !(result instanceof Vrapper))) {
    const rawId = (result.reference && !(result instanceof Vrapper))
      ? result.reference.rawId() : result.getRawId();

    const resultNode
      = Datafactory.namedNode(`<${baseIdUrn + rawId}>`);

    if (term && term.variable && session) {
      let variable = session.variables[term.variable];
      if (!variable) variable = resultNode;
      else if (variable && !variable.data) {
        variable = { data: [variable, resultNode] };
      } else variable.data.push(resultNode);

      session.variables[term.variable] = variable;
    }
    return resultNode;
  }

  const resultValue = result.value;
  const value = (resultValue === null)
    ? "" : (typeof resultValue === "object" && resultValue !== null)
    ? JSON.stringify(resultValue) : resultValue;

  const datatype
    = Datafactory.namedNode(dataTypes[(resultValue === null) ? "null" : typeof resultValue]);

  return Datafactory.literal(value, datatype);
}

function _getInitialTermValue (term: any, source: CorpusQuadSource, type: String) {
  let termData = {};
  if (!term) return termData;

  if (term.termType === "BlankNode" || term.termType === "Variable") {
    termData.variable = term.value;

    const sessionVariable
      = source._context[source.querySessionSymbol].variables[term.value];
    if (sessionVariable && type !== "object") {
      termData = (Array.isArray(sessionVariable.data)
        && sessionVariable.length !== 0)
        ? sessionVariable : Datafactory.namedNode(sessionVariable);
    }
  } else termData.value = term.value;

  if (Array.isArray(termData.data) && termData.data.length !== 0) {
    for (let i = 0; i < termData.data.length; i++) {
      termData.data[i] = _parseTerm(termData.data[i], type);
    }
  } else termData = _parseTerm(termData, type);

  return termData;
}

function _parseTerm (term: Object, type: String) {
  const iriMatch = term && term.value
    && typeof term.value === "string"
    && (term.value.match(/http:\/\/valospace.org\/(.*)/)
    || term.value.match(/<valos:id:(.*)>/));

  if (iriMatch) {
    const suffix = iriMatch[1].split("/");
    term.id = (suffix[1]) ? suffix[1] : suffix[0];

    if (type !== "predicate") return term;

    switch (suffix[0]) {
      case "namedProperty":
        term.kuery = VALEK.property(term.id); break;
      case "namedPropertyValue":
        term.kuery = VALEK.property(term.id).toField("value"); break;
      case "property":
        term.kuery = VALEK.toField("properties"); break;
      case "namedRelation":
        term.kuery = VALEK.toField("relations")
          .find(VALEK.hasName(term.id)); break;
      case "namedRelationTarget":
        term.kuery = VALEK.toField("relations")
          .find(VALEK.hasName(term.id)).toField("target"); break;
      case "relation":
        term.kuery = VALEK.toField("relations"); break;
      case "media":
      case "entity":
        term.kuery = VALEK.toField("unnamedOwnlings");
        term.filterType = suffix[0]; break;
      case "ownling":
        term.kuery = VALEK.toField("unnamedOwnlings"); break;
      case "value":
        term.kuery = VALEK.toField("value"); break;
      case "target":
        term.kuery = VALEK.toField("target"); break;
      default:
        delete term.id; break;
    }
  }

  return term;
}

Object.defineProperty(exports, "__esModule", { value: true });
module.exports = { CorpusQuadSource, dataTypes };
