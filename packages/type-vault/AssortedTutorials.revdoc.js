
const {
  extractee: { authors, cli, ref, },
} = require("@valos/type-vault/revdoc");

module.exports = {
  "dc:title": "Assorted tutorials",
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("Jaradacl"),
    authors: authors(),
    shortName: "assortedTutorials",
  },
  "chapter#abstract>0": [
    "This document is a collection of tutorials and possibly other notes",
    " created by Jaradacl based on the tasks given. (During first few days at least)",
  ],
  "chapter#sotd>1": [
    "This document is part of the toolset workspace ",
    ref("@valos/type-vault"),
    " (of domain ", ref("@valos/kernel"), ") which is ",
    "A valma toolset for managing valos vault monorepository workspaces",
  ],
  "chapter#how_to_create_revdoc>2;How to create RevDoc": [
    "This is a step-by-step guide on how to create RevDoc using cli.",
    { "numbered#": [
      "Ensure you have python installed.",
      ["Navigate to the folder you want your revdoc.js to reside and run the following command: ",
        cli("vlm create-revdoc YOUR_DOCUMENT_NAME_WITHOUT_FILE_EXTENSION"),
        " Note: If you create your RevDoc under the revdocs/ folder, ",
        "your HTML and JSONLD files will be generated to the project root",
      ],
      ["You will now be asked the following information: ",
        { "bulleted#": [
          "Title of the document: This is human-readable title of the document.",
          "ReSpec short name",
          "Document editors: Comma-separated value of the editors of your document.",
          "Document authors: Comma-separated value of the authors of your document.",
        ] }
      ],
      ["Next navigate to the root of your project and run the following command ",
      cli("vlm regenerate-docs"),
      " This will create HTML and JSONLD files based on your RevDoc"],
      ["Now run the following command ",
      cli("python -m SimpleHTTPServer")],
      "Open browser and navigate to the localhost in the port you just opened. (8000 by default)",
      ["Your HTML and JSONLD files can now be found ",
        "under docs/ in the same path as where you saved your RevDoc file; ",
        "for example if you saved your RevDoc under packages/type-vault ",
        "it can now be found under docs/packages/type-vault.",
      ],
    ] }
  ],
};
