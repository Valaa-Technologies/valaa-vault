module.exports = {
  DestroyedScriptResource: {
    "@type": "valos:Type",
    "rdfs:subClassOf": ["valos:TransientFields", "valos:Resource"],
    "revdoc:brief": "destroyed script resource",
    "rdfs:comment":
`The class of valospace script resources which have been destroyed in
this view of the world. It only provides the external fields listed in
TransientScripFields and TransientFields interfaces.`,
  },
};
