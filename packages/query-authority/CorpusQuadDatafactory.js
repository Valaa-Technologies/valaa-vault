// @flow

class DataFactory {
  static namedNode (value: String) {
    return new NamedNode(value);
  }

  static blankNode (value?: string) {
    return new BlankNode((!value) ? "" : value);
  }

  static literal (value: String, languageOrDatatype?: any) {
    return new Literal(value, languageOrDatatype);
  }

  static variable (value: String) {
    return new Variable(value);
  }

  static defaultGraph () {
    return new DefaultGraph();
  }

  static quad (subject: Term, predicate: Term, object: Term, graph?: Term) {
    return new Quad(subject, predicate, object, graph);
  }

  static fromTerm (original: Term) {
    if (!original || !(original instanceof Term)) throw new Error("Term needs to be supplied.");

    return new original.constructor(original.value, original.language);
  }

  static fromQuad (original: Quad) {
    if (!original || !(original instanceof Quad)) throw new Error("Quad needs to be supplied.");

    return new Quad(original.subject, original.predicate,
      original.object, original.graph);
  }
}

class Quad {
  constructor (subject: Term, predicate: Term, object: Term, graph?: Term) {
    this.subject = subject;
    this.predicate = predicate;
    this.object = object;
    this.graph = (!graph) ? new DefaultGraph() : graph;
  }

  equals (other?: Term) {
    return (other !== null && other !== undefined
      && this.subject.equals(other.subject)
      && this.predicate.equals(other.predicate)
      && this.object.equals(other.object)
      && this.graph.equals(other.graph));
  }
}

class Term {
  constructor (termType: String, value: String) {
    this.termType = termType;
    this.value = value;
  }

  equals (other?: Term) {
    return (other !== null && other !== undefined
      && other.termType === this.termType);
  }
}

class NamedNode extends Term {
  constructor (value: String) {
    super("NamedNode", value);
  }

  equals (other?: Term) {
    return (super.equals(other) && this.value === other.value);
  }
}

class BlankNode extends Term {
  constructor (value: String) {
    super("BlankNode", value);
  }

  equals (other?: Term) {
    return (super.equals(other) && this.value === other.value);
  }
}

class Literal extends Term {
  constructor (value: String, languageOrDatatype?: any) {
    super("Literal", value);

    if (languageOrDatatype instanceof NamedNode) {
      this.language = "";
      this.datatype = languageOrDatatype;
    } else if (languageOrDatatype) {
      this.language = languageOrDatatype;
      this.datatype = new NamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#langString");
    } else {
      this.language = "";
      this.datatype = new NamedNode("http://www.w3.org/2001/XMLSchema#string");
    }
  }

  equals (other?: Term) {
    return (super.equals(other) && this.value === other.value
      && this.language === other.language
      && this.datatype.equals(other.datatype));
  }
}

class Variable extends Term {
  constructor (value: String) {
    const match = value.match(/[?](.*)|(.*)/);

    super("Variable", (match[1]) ? match[1] : match[0]);
  }

  equals (other?: Term) {
    return (super.equals(other) && this.value === other.value);
  }
}

class DefaultGraph extends Term {
  constructor () {
    super("DefaultGraph", "");
  }

  equals (other?: Term) {
    return super.equals(other);
  }
}

Object.defineProperty(exports, "__esModule", { value: true });
module.exports = {
  default: DataFactory, NamedNode, BlankNode, Literal,
  Variable, DefaultGraph
};
