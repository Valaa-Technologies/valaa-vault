// @flow

import { emit, ontology as vdocOntology } from "../packages/toolset-vault/vdoc";
import { ontology as revdocOntology } from "../packages/toolset-vault/revdoc";

const vdocVSONLDoc = require("./vdoc.vsonldoc");
const revdocVSONLDoc = require("./revdoc.vsonldoc");

describe("VDoc", () => {
  it("0000049: creates an entity with property and duplicates it", () => {
    // console.log("vsonldoc:\n", JSON.stringify(vdocVSONLDoc, null, 2));
    const htmlEmission = emit("", revdocVSONLDoc, [revdocOntology, vdocOntology], "html");
    console.log("html:\n", htmlEmission);
  });
});
