module.exports = {
  ScriptResource: {
    "@type": "valos-raem:Type",
    "rdfs:subClassOf": ["valos:Resource"],
    "revdoc:brief": "valoscript resource interface",
    "rdfs:comment":
`The class of valospace resources which have script references to them
from within this world. The domain of all transient and generated
fields which are available even for out-of-this-world resources.`,
  },

  incomingRelations: {
    "@type": "valos-raem:TransientField",
    "rdfs:domain": "valos:ScriptResource",
    "rdfs:range": "valos:Relation",
    "valos-raem:coupledField": "valos:target",
    "rdfs:comment":
`The unordered set of relations that are targeting this relatable
resource within this view of the world.`,
  },
};
