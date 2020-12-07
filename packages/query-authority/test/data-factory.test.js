// @flow

const dataFactory = require("../CorpusQuadDatafactory.js");

const factory = dataFactory.default;
const NamedNode = dataFactory.NamedNode;
const BlankNode = dataFactory.BlankNode;
const Literal = dataFactory.Literal;
const Variable = dataFactory.Variable;
const DefaultGraph = dataFactory.DefaultGraph;

function _checkNode (instance: Object, type: Object, value: String) {
  expect(instance instanceof type).toBe(true);
  expect(instance.value).toBe(value);
}

describe("NamedNode", () => {
  it("creates NamedNode instance", () => {
    const iri = "http://valospace.org";
    _checkNode(factory.namedNode(iri), NamedNode, iri);
  });

  it(`creates two NamedNode instances with same params
    and checks for equality`, () => {
    const iri = "http://valospace.org";
    expect(factory.namedNode(iri).equals(factory.namedNode(iri))).toBe(true);
  });
});

describe("BlankNode", () => {
  it("creates BlankNode instance", () => {
    const value = "blank";
    _checkNode(factory.blankNode(value), BlankNode, value);
  });

  it(`creates two BlankNode instances with same params
    and checks for equality`, () => {
    const blank = "http://valospace.org";
    expect(factory.blankNode(blank)
      .equals(factory.blankNode(blank))).toBe(true);
  });
});

describe("Literal", () => {
  it(`creates Literal instance with
    string value and lang tag`, () => {
    const lang = "en";
    const value = "english_string";
    const literal = factory.literal(value, lang);
    _checkNode(literal, Literal, value);
    expect(literal.language).toBe(lang);
    _checkNode(literal.datatype, NamedNode,
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString");
  });

  it(`creates Literal instance with
    string value and no datatype`, () => {
    const value = "string_value";
    const literal = factory.literal(value);
    _checkNode(literal, Literal, value);
    expect(literal.language).toBe("");
    _checkNode(literal.datatype, NamedNode,
      "http://www.w3.org/2001/XMLSchema#string");
  });

  it(`creates Literal instance with
    non-string value and datatype`, () => {
    const value = 42;
    const xsInt = "http://www.w3.org/2001/XMLSchema#int";
    const literal = factory.literal(value, factory.namedNode(xsInt));

    _checkNode(literal, Literal, value);
    expect(literal.language).toBe("");
    _checkNode(literal.datatype, NamedNode, xsInt);
  });

  it(`creates two Literal instances with same params
    and checks for equality`, () => {
    const lang = "en";
    const value = "english_string";

    expect(factory.literal(value, lang)
      .equals(factory.literal(value, lang))).toBe(true);
  });
});

describe("Variable", () => {
  it("creates BlankNode instance", () => {
    _checkNode(factory.variable("?var"), Variable, "var");
  });

  it(`creates two Variable instances with same params
    and checks for equality`, () => {
    const variable = "?var";
    expect(factory.blankNode(variable)
      .equals(factory.blankNode(variable))).toBe(true);
  });
});

describe("DefaultGraph", () => {
  it("creates DefaultGraph instance", () => {
    _checkNode(factory.defaultGraph(), DefaultGraph, "");
  });

  it(`creates two Defaultgraphs instances
    and checks for equality`, () => {
    expect(factory.defaultGraph()
      .equals(factory.defaultGraph())).toBe(true);
  });
});

describe("Quad", () => {
  it("creates Quad instance without graph", () => {
    const subjectIri = "https://subject.org";
    const predicateIri = "https://predicate.org";
    const objectValue = "variable_string";

    const quad = factory.quad(
      factory.namedNode(subjectIri), factory.namedNode(predicateIri),
      factory.literal(objectValue));

    expect(quad).not.toBeFalsy();
    _checkNode(quad.subject, NamedNode, subjectIri);
    _checkNode(quad.predicate, NamedNode, predicateIri);
    _checkNode(quad.object, Literal, objectValue);
    _checkNode(quad.object.datatype, NamedNode,
      "http://www.w3.org/2001/XMLSchema#string");
    _checkNode(quad.graph, DefaultGraph, "");
  });

  it("creates Quad instance with graph", () => {
    const subjectIri = "https://subject.org";
    const predicateIri = "https://predicate.org";
    const objectValue = "variable_string";
    const graphValue = "https://graph.org";

    const quad = factory.quad(
      factory.namedNode(subjectIri), factory.namedNode(predicateIri),
      factory.literal(objectValue), factory.namedNode(graphValue));

    expect(quad).not.toBeFalsy();
    _checkNode(quad.subject, NamedNode, subjectIri);
    _checkNode(quad.predicate, NamedNode, predicateIri);
    _checkNode(quad.object, Literal, objectValue);
    _checkNode(quad.object.datatype, NamedNode,
      "http://www.w3.org/2001/XMLSchema#string");
    _checkNode(quad.graph, NamedNode, graphValue);
  });

  it(`creates two Quad instances with same params
    and checks for equality`, () => {
    const subjectIri = "https://subject.org";
    const predicateIri = "https://predicate.org";
    const objectValue = "variable_string";
    const graphValue = "https://graph.org";

    const quad = factory.quad(
      factory.namedNode(subjectIri), factory.namedNode(predicateIri),
      factory.literal(objectValue), factory.namedNode(graphValue));

    const anotherQuad = factory.quad(
      factory.namedNode(subjectIri), factory.namedNode(predicateIri),
      factory.literal(objectValue), factory.namedNode(graphValue));

    expect(quad.equals(anotherQuad)).toBe(true);
  });
});

describe("Datafactory functions", () => {
  it(`creates new instance of existing
    term using the fromTerm function`, () => {
    const literal = factory.literal("english_string", "en");

    expect(literal.equals(factory.fromTerm(literal))).toBe(true);
  });

  it(`creates new instance of existing
    quad using the fromQuad function and tests for equality`, () => {
      const quad = factory.quad(
        factory.namedNode("https://subject.org"),
        factory.namedNode("https://predicate.org"),
        factory.literal("variable_string"),
        factory.namedNode("https://graph.org")
      );

      expect(quad.equals(factory.fromQuad(quad))).toBe(true);
  });
});
