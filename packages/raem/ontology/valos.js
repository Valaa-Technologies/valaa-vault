module.exports = {
  "@context": {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    owl: "http://www.w3.org/2002/07/owl#",
    dc: "http://purl.org/dc/elements/1.1/",
    valos: "https://valospace.org/#",
    "@base": "https://valospace.org/#",
    "valos:restriction": { "@reverse": "owl:onProperty" },
  },
  Class: { "@type": "valos:Class",
    "rdfs:subClassOf": "rdfs:Class",
    "rdfs:comment":
`The class of classes which are specified by the ValOS kernel ontology.`,
  },
  Property: { "@type": "valos:Class",
    "rdfs:subClassOf": "rdf:Property",
    "rdfs:comment":
`The class of properties which are specified by the ValOS kernel ontology.`,
  },
  Kuery: { "@type": "valos:Class",
    "rdfs:comment":
`The class of resources which represent VALK kueries.`,
  },
  Type: { "@type": "valos:Class",
    "rdfs:subClassOf": "rdfs:Class",
    "rdfs:comment":
`The class of all valospace type classes.`,
  },
  Field: { "@type": "valos:Class",
    "rdfs:subClassOf": "rdf:Property",
    "rdfs:comment":
`The class of properties with custom semantics inside valospace.
Instances of this class are called valos resource fields. All resource
fields have valos:Type or one of its sub-classes as their rdf:domain.`,
  },
  PrimaryField: {
    "@type": "valos:Class",
    "rdfs:subClassOf": "valos:Field",
    "rdfs:comment":
`The class of valos fields which are primary, persisted sources of
truth and have both a state representation inside valospace and a
change representation in event logs.`
  },
  TransientField: {
    "@type": "valos:Class",
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
    "@type": "valos:Class",
    "rdfs:subClassOf": "valos:Field",
    "rdfs:comment":
`The class of valos fields with inference semantics which specify how
new triples with the inferred field as a predicate can be inferred
from existing triples.`
  },
  GeneratedField: {
    "@type": "valos:Class",
    "rdfs:subClassOf": "valos:InferredField",
    "rdfs:comment":
`The class of inferred fields where a field is associated with a
'generator', a convergent procedural rule like taking an average or
retrieving the partition of a valos Resource. As convergent rules a
GeneratedField's can't have mutation semantics that could be reliably
translated back to mutations of other triples.`,
  },
  generator: {
    "@type": "valos:Property",
    "rdfs:domain": "valos:GeneratedField", "rdfs:range": "rdfs:Resource",
    "rdfs:comment":
`The generator algorithm specification or identifier of
a GeneratedField.`
  },
  AliasField: {
    "@type": "valos:Class",
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
    "@type": "valos:Property",
    "rdfs:domain": "valos:AliasField", "rdfs:range": "valos:Field",
    "rdfs:comment":
`The alias target property specifies the inference source and mutation
target of an alias field.`,
  },
  isOwned: {
    "@type": "valos:Property",
    "rdfs:domain": "valos:Field", "rdfs:range": "xsd:boolean",
    "rdfs:comment":
`This field owns the targeted resource. If the subject of this field
is destroyed the targeted resource will be cascade destroyed.`,
  },
  isOwning: {
    "@type": "valos:Property",
    "rdfs:domain": "valos:Field", "rdfs:range": "xsd:boolean",
    "rdfs:comment":
`This field is a coupled field of an owning field. If the owning field
is destroyed this resource will be be cascade destroyed.`,
  },
  coupledField: {
    "@type": "valos:Property",
    "rdfs:domain": "valos:Field", "rdfs:range": "valosField",
    "rdfs:comment":
``,
  },
  defaultCoupledField: {
    "@type": "valos:Property",
    "rdfs:domain": "valos:Field", "rdfs:range": "xsd:string",
    "rdfs:comment":
``,
  },
  preventsDestroy: {
    "@type": "valos:Property",
    "rdfs:domain": "valos:Field", "rdfs:range": "xsd:boolean",
    "rdfs:comment":
`Field with this property prevent destruction of their subject
resource if the field has active couplings inside the same partition.`,
  },
  isDuplicateable: {
    "@type": "valos:Property",
    "rdfs:domain": "valos:Field", "rdfs:range": "xsd:boolean",
    "rdfs:comment":
`If set to false this field not be visible for DUPLICATED class of
events.`,
  },
  initialValue: {
    "@type": "valos:Property",
    "rdfs:domain": "valos:Field", "rdfs:range": "rdfs:Resource",
    "rdfs:comment":
`The implicit initial value of the resource field when the resource is
created.`,
  },
  ownDefaultValue: {
    "@type": "valos:Property",
    "rdfs:domain": "valos:Field", "rdfs:range": "rdfs:Resource",
    "rdfs:comment":
`The value of a resource field which doesn't have an own value defined
(ie. is evaluated before prototype field lookup).`,
  },
  finalDefaultValue: {
    "@type": "valos:Property",
    "rdfs:domain": "valos:Field", "rdfs:range": "rdfs:Resource",
    "rdfs:comment":
`The value of a resource field which doesn't have a value defined by
any resource in its prototype chain.`,
  },
  allowTransientFieldToBeSingular: {
    "@type": "valos:Property",
    "rdfs:domain": "valos:Field", "rdfs:range": "xsd:boolean",
    "rdfs:comment":
`Bypass the default behavior which forces transient fields to be plural
to allow for singular fields.`,
  },
};
