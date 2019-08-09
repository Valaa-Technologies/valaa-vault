const { createOntology } = require("@valos/vdoc");

const name = require("./package").name;

const prefix = "valos";
const prefixIRI = "https://valospace.org/#";

const vocabulary = Object.values(require("./documents"))
    .filter(document => (document.tags || []).includes("ONTOLOGY"))
    .reduce((a, document) => {
      if (document.package === name) return a;
      const ontology = require(`${document.package}/ontology`);
      if (ontology.prefixIRI === prefixIRI) {
        Object.assign(a, ontology.vocabulary);
      }
      return a;
    }, {});

module.exports = createOntology(prefix, prefixIRI, {
  prefixes: {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    owl: "http://www.w3.org/2002/07/owl#",
    dc: "http://purl.org/dc/elements/1.1/",
    valos: "https://valospace.org/#",
    vdoc: "https://valospace.org/vdoc#",
  },
  vocabulary,
});
