Object.defineProperty(exports, "__esModule", { value: true });

const busRdfResolveQuadPattern = require("@comunica/bus-rdf-resolve-quad-pattern");
const asyncIterator = require("asynciterator").AsyncIterator;

class ActorRdfResolveQuadPatternValosSource
  extends busRdfResolveQuadPattern.ActorRdfResolveQuadPatternSource {

  async test (action) {
    return (_getValosSource(action.context));
  }

  async getSource (context) {
    return _getValosSource(context).value;
  }

  async getOutput (source, pattern, context) {
    const result = source.match(pattern.subject, pattern.predicate,
      pattern.object, pattern.graph, context.get("context"));

    return { data: asyncIterator.wrap(result) };
  }
}

function _getValosSource (context) {
  const sources = context
      .get(busRdfResolveQuadPattern.KEY_CONTEXT_SOURCES);

    if (!sources || !sources.iterator) {
      throw new Error(`${this.name} received no sources or
        sources is not an asynciterator.`);
    }

    // Only supports one source for now
    const valosSource = sources.iterator().read();

    if (!valosSource || typeof valosSource === "string"
      || !valosSource.value.match || valosSource.type !== "rdfValosSource") {
      throw new Error(`${this.name} received no valos source or valos source is not valid.`);
    }

    return valosSource;
}

exports.ActorRdfResolveQuadPatternValosSource = ActorRdfResolveQuadPatternValosSource;
