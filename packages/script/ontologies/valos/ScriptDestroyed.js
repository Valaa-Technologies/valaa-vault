module.exports = {
  ScriptDestroyed: {
    "@type": "valos-raem:Type",
    "rdfs:subClassOf": ["valos:Resource", "valos:ScriptResource"],
    "revdoc:brief": "destroyed script resource type",
    "rdfs:comment":
`The class of valospace script resources which have been destroyed in
this view of the world. It only provides the external fields listed in
TransientScripFields and TransientFields interfaces.`,
  },
};
