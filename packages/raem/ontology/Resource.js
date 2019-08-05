module.exports = {
  Resource: {
    "rdf:type": "valos:Type",
    "rdfs:subClassOf": "valos:TransientFields",
    "revdoc:brief": "resource",
    "rdfs:comment":
`A first-class object with fields and properties that can be directly
created and mutated using events in associated partition event logs.
Resources have an identity and can be destroyed, subsequently
destroying all resources which are in the ownership hierarchy of this
Resource.`,
  },

  owner: {
    "rdf:type": "valos:PrimaryField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:isOwned": true,
    "valos:defaultCoupledField": "valos:ownlings",
    "rdfs:comment":
`The owner of this Resource`,
  },

  name: {
    "rdf:type": "valos:PrimaryField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "xsd:string",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The primary ValOS name of this Resource. It is globally non-unique but
often context-dependently unique.`,
  },

  nameAlias: {
    "rdf:type": "valos:AliasField",
    "valos:aliasOf": "valos:name",
    "rdfs:subPropertyOf": "valos:name",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "xsd:string",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The primary name of this Resource. It is globally non-unique but often
context-dependently unique.
This is an alias of Resource.name for circumventing conflicts with the
native javascript property 'name' in some execution contexts`,
  },

  ownlings: {
    "rdf:type": "valos:PrimaryField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    "valos:isOwning": true,
    "valos:coupledField": "valos:owner",
    "rdfs:comment":
`Collection of all the resources owned by this Resource via all
properties that are marked as valos:isOwning.`
  },

  unnamedOwnlings: {
    "rdf:type": "valos:PrimaryField",
    "rdfs:subPropertyOf": "valos:ownlings",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    "valos:isOwning": true,
    "valos:coupledField": "valos:owner",
    "rdfs:comment":
`All the resources owned by this Resource which are not part of another
named owning property`,
  },

  isFrozen: {
    "rdf:type": "valos:PrimaryField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "xsd:boolean",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:cardinality": 1 },
    "valos:isDuplicateable": false,
    "valos:immediateDefaultValue": false,
    "rdfs:comment":
`Indicates whether this Resource is frozen. A frozen Resource nor any
of its ownlings cannot have any of their primary fields be modified.
Setting isFrozen to true is (by design) an irreversible operation.
If this Resource is also the root resource of a partition the whole
partition is permanently frozen.`,
  },
};
