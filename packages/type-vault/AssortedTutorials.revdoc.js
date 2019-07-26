const {
  extractee: { authors, cli, pkg, },
} = require("@valos/revdoc");

module.exports = {
  "dc:title": "Assorted tutorials",
  "vdoc:tags": ["PRIMARY", "HOW_TO"],
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
    "This document is part of the toolset workspace ", pkg("@valos/type-vault"),
    " (of domain ", pkg("@valos/kernel"), ") which is ",
    "A valma toolset for managing valos vault monorepository workspaces",
  ],
  "chapter#how_to_create_revdoc>2;How to create RevDoc": [
    "This is a step-by-step guide on how to create RevDoc using cli.",
    { "numbered#": [
      "Ensure you have python installed.",
      ["Navigate to the folder you want your revdoc.js to reside and run the following command: ",
        cli("vlm write-revdoc YOUR_DOCUMENT_NAME_WITHOUT_FILE_EXTENSION"),
        " Note: If you create your RevDoc under the revdocs/ folder, ",
        "your HTML and VDocLD files will be generated to the project root",
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
      " This will create HTML and VDocLD files based on your RevDoc"],
      ["Now run the following command ",
      cli("python -m SimpleHTTPServer")],
      "Open browser and navigate to the localhost in the port you just opened. (8000 by default)",
      ["Your HTML and VDocLD files can now be found ",
        "under docs/ in the same path as where you saved your RevDoc file; ",
        "for example if you saved your RevDoc under packages/type-vault ",
        "it can now be found under docs/packages/type-vault.",
      ],
    ] }
  ],
  "chapter#feature_branch_lifecycle_git>3;Feature branch lifecycle in Git": [
    "This chapter briefly describes the lifecycle of a feature branch step-by-step using Git.",
    "Chapter works as a guide.",
    { "numbered#": [
      ["After ensuring you are in a prerelease branch, creating new branch is as easy as running: ",
        cli("git checkout -b path/to/your/branch"),
      ],
      "Now you have your branch, so it's time for edits.",
      "TO BE CONTINUED (rebase, commit, push etc.)",
    ] }
  ],
  "chapter#creating_new_library_valma>4;Creating a new library with valma": [
    "Guide on how to create a new library using valma. ",
    "Note: Scope of this guide covers only the creation of a public library. ",
    "It does not cover all of the different options while initalizing.",
    "As of now does not cover other use cases either.",
    { "numbered#": [
      ["Create a folder for your new library and navigate to there. Run the following command: ",
        cli("vlm init"),
        " Script will prompt you multiple times to choose, right options are listed here."
      ],
      { "numbered#": [
        `Select "Initialize" when it asks about package.json initialization.`,
        `Select "Yes" for whether the package is public.`,
        `Select "Initialize" when it asks about initializing repository info.`,
        `Select "Library" as the valos.type and confirm it.`,
        `Select "@valos/kernel" for the valos.domain and confirm twice.`,
        `Select "skip" for whether to add initial workshops or toolsets as devDependencies`,
        [`Select "configure" for whether to configure the repository with `,
          cli("vlm configure")
        ],
        `Select "@valos/type-vault/enable-babel" to use from available toolsets.`,
        `Select "Yes" for whether to enable babel transpilation for the library`,
      ] },
      ["Your library is now created. ",
        ref("You can now continue by getting your library ready for testing.",
          "#getting_ready_for_testing"),
      ]
    ] }
  ],
  "chapter#getting_ready_for_testing>5;Getting ready for testing with Jest": [
    "Guide on how to get your library ready for testing with Jest.",
    { "numbered#": [
        ["Create the following files into your library folder: ",
          { "bulleted#": [
            "your-library-name.test.js",
            "index.js"
          ] },
        ],
        [`Add the following code snippet to your "your-library-name.test.js" file:`,
          null,
          `import foo from "./index.js";

          describe("your-library-name", () => {
            it("*", () => {
              expect(foo())
                  .toEqual(true);
            });
          });`,
        ],
        [`And then the following snippet to the  "index.js" file:"`,
          null,
          `// @flow

          export default function foo () {
            return true;
          }`,
        ],
        [`And lastly ensure that you have the following section in your "package.json`,
          `{
            "scripts": {
              "test": "jest"
            }
          }`,
        ],
        "Before trying out your test environment, ensure you have Jest installed using yarn.",
        ["Finally, you can test your test environment by navigating ",
          "to the project root and running the following command:",
          cli("yarn test your-library-name"),
          "If all tests pass, your test environment is up and running! ",
          "You can find more on Jest ",
          ref("here", "https://jestjs.io")
        ]
    ] },
  ],
  "chapter#adding_bash_completion_vlm_commands>6;Adding bash completion for Valma commands": [
    "Just run the following command:",
    cli("/path/to/your/project/node_modules/.bin/vlm bash-completion >> ~/.bashrc"),
    "This adds the bash-completion script inside you .bashrc.",
    "Now you can complete your vlm commands as you would",
    " e.g. your paths by just pressing tab.",
  ],
  "chapter#assembling_local_packages>7;How to assemble local packages for local use": [
    "Sometimes you may need to use your own packages with your project. ",
    "To do this you need to assemble the packages and add them to a local repository ",
    "from which they can then be used. ",
    "To assemble your packages and add them ",
    "to a local repository, run the following command inside your project root:",
    cli("vlm assemble-packages --add-unchanged --yalc-push --yalc-add"),
    "This assembles your packages and adds them to a local Yalc repository. ",
    "Find out more about Yalc ",
    ref("here", "https://github.com/whitecolor/yalc"),
  ],
};
