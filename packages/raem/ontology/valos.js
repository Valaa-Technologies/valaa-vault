module.exports = {
  "@context": {
    dc: "http://purl.org/dc/elements/1.1/",
    owl: "http://www.w3.org/2002/07/owl#",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    a: "rdf:type",
    valos: "https://valospace.org/#",
    "@base": "https://valospace.org/#",
    "valos:propertyRestriction": { "@reverse": "owl:onProperty" },
  },
  Class: { "rdf:type": "valos:Class",
    "rdfs:subClassOf": "rdfs:Class",
    "rdfs:comment":
`The class of classes which are specified by the ValOS kernel ontology.`,
  },
  Property: { "rdf:type": "valos:Class",
    "rdfs:subClassOf": "rdf:Property",
    "rdfs:comment":
`The class of properties which are specified by the ValOS kernel ontology.`,
  },
  Type: { "rdf:type": "valos:Class",
    "rdfs:subClassOf": "rdfs:Class",
    "rdfs:comment":
`The class of all valospace type classes.`,
  },
  Field: { "rdf:type": "valos:Class",
    "rdfs:subClassOf": "rdf:Property",
    "rdfs:comment":
`The class of properties with custom semantics inside valospace.
Instances of this class are called valos fields.`,
  },
  PrimaryField: {
    "rdf:type": "valos:Class",
    "rdfs:subClassOf": "valos:Field",
    "rdfs:comment":
`The class of valos fields which are primary, persisted sources of
truth and have both a state representation inside valospace and a
change representation in event logs.`
  },
  TransientField: {
    "rdf:type": "valos:Class",
    "rdfs:subClassOf": "valos:Field",
    "rdfs:comment":
// TODO(iridian): Merge inference and transience together conceptually
// on the specification level, as their difference is just an
// implementation detail: transient fields have actual state in the
// corpus whereas inferred fields are programmatically generated during
// queries and mutations. But from the model perspective there should
// be no difference.
`The class of valos fields which have primary state representations
inside valospace but which have only inferred representation in event
logs.`
  },
  InferredField: {
    "rdf:type": "valos:Class",
    "rdfs:subClassOf": "valos:Field",
    "rdfs:comment":
`The class of valos fields with inference semantics which specify how
new triples with the inferred field as a predicate can be inferred
from existing triples.`
  },
  GeneratedField: {
    "rdf:type": "valos:Class",
    "rdfs:subClassOf": "valos:InferredField",
    "rdfs:comment":
`The class of inferred fields where a field is associated with a
'generator', a convergent procedural rule like taking an average or
retrieving the partition of a valos Resource. As convergent rules a
GeneratedField's can't have mutation semantics that could be reliably
translated back to mutations of other triples.`,
  },
  generator: {
    "rdf:type": "valos:Property",
    "rdfs:domain": "valos:GeneratedField", "rdfs:range": "rdfs:Resource",
    "rdfs:comment":
`The generator algorithm specification or identifier of
a GeneratedField.`
  },
  AliasField: {
    "rdf:type": "valos:Class",
    "rdfs:subClassOf": "valos:InferredField",
    "rdfs:comment":
`The class of inferred fields called alias fields where each such field
has an 'aliasOf' RDF property or valos Field. Alias fields are
mutation-inference symmetric so that triples with an alias field as
predicate are inferred from triples with aliasOf as predicate and
mutations with an alias field as predicate are translated to use
the aliasOf as predicate.`,
  },
  aliasOf: {
    "rdf:type": "valos:Property",
    "rdfs:domain": "valos:AliasField", "rdfs:range": "valos:Field",
    "rdfs:comment":
`The alias target property specifies the inference source and mutation
target of an alias field.`,
  },
  coupledField: {
    "rdf:type": "valos:Property",
    "rdfs:domain": "valos:Field", "rdfs:range": "xsd:string",
    "rdfs:comment":
``,
  },
  defaultCoupledField: {
    "rdf:type": "valos:Property",
    "rdfs:domain": "valos:Field", "rdfs:range": "xsd:string",
    "rdfs:comment":
``,
  },
  isOwned: {
    "rdf:type": "valos:Property",
    "rdfs:domain": "valos:Field", "rdfs:range": "xsd:boolean",
    "rdfs:comment":
`This field owns the targeted resource. If the subject of this field
is destroyed the targeted resource will be cascade destroyed.`,
  },
  isOwning: {
    "rdf:type": "valos:Property",
    "rdfs:domain": "valos:Field", "rdfs:range": "xsd:boolean",
    "rdfs:comment":
`This field is a coupled field of an owning field. If the owning field
is destroyed this resource will be be cascade destroyed.`,
  },
  isDuplicateable: {
    "rdf:type": "valos:Property",
    "rdfs:domain": "valos:Field", "rdfs:range": "xsd:boolean",
    "rdfs:comment":
`If set to false this field not be visible for DUPLICATED class of
events.`,
  },
  immediateDefaultValue: {
    "rdf:type": "valos:Property",
    "rdfs:domain": "valos:Field", "rdfs:range": "rdfs:Resource",
    "rdfs:comment":
`The immediate default value for a field when the field doesn't have
an own value, ie. bypassing prototype lookups.`,
  },
  allowTransientFieldToBeSingular: {
    "rdf:type": "valos:Property",
    "rdfs:domain": "valos:Field", "rdfs:range": "xsd:boolean",
    "rdfs:comment":
`Bypass the default behavior which forces transient fields to be plural
to allow for singular fields.`,
  },
};
