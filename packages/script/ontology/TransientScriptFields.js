module.exports = {
  TransientScriptsFields: {
    "@type": "valos:Type",
    "rdfs:subClassOf": ["valos:TransientScriptFields"],
    "revdoc:brief": "transient script fields",
    "rdfs:comment":
`The class of valos script resources which are not active within the
current view of the world but which have references to them. As such
it is the domain of all transient and generated script fields.`,
  },

  incomingRelations: {
    "@type": "valos:TransientField",
    "rdfs:domain": "valos:TransientScriptFields",
    "rdfs:range": "valos:Relation",
    "valos:coupledField": "valos:target",
    "rdfs:comment":
`Unordered set of relations that are targeting this relatable resource.`,
  },
};
