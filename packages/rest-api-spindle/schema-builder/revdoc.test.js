const {
  extractee: {
    c, blockquote, authors, em, ref, pkg,
    prepareTestDoc, extractExampleText,
  },
} = require("@valos/revdoc");

const {
  BooleanType, ObjectSchema, StringType, ResourceType, extendType, mappingToManyOf,
  sharedSchemaOf, exportSchemaOf,
} = require("./types");

const {
  listingGETRoute, resourceGETRoute, mappingPOSTRoute, sessionGETRoute, sessionDELETERoute
} = require("./routes");

const {
  createTestTagType, TestTagType, createTestThingType, TestThingType,
} = require("../test/test-types");

const title = "REST API Schema Builder TestDoc";
const { itExpects, runTestDoc } = prepareTestDoc(title);

const _createTestGlobalRules = () => ({
  scriptRoot: ["$~gh:0123456789abcdef"],
  ":ofMapping": {
    tags: { routeRoot: ["$~u4:aaaabbbb-cccc-dddd-eeee-ffffffffffff"] },
  },
  ":ofMethod": { POST: {
    ":ofMapping": { tags: {
      oesType: "tag",
    }, },
  }, },
});
const testGlobalRules = _createTestGlobalRules();

module.exports = {
  "dc:title": title,
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "restSchemaBuilder",
  },
  "chapter#abstract>0": {
    "#0": [
`Schema builder is a javascript library for exporting a site
configuration that can be consumed by the REST API spindle. This config
is a fully declarative `, ref("JSON schema", "http://json-schema.org/"),
`-based format which not just describes the external API routes and
types but also defines their valospace projections using embedded `,
ref("vpath", "@valos/raem/VPath"), `.

This library is primarily intended to be used from inside a
`, em("spindle configuration library"), ` which is invoked from inside
a `, ref("revela.json", "@valos/inspire/revela"), ` gateway to emit
the JSON configuration.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`At the time of writing this document has triple responsibilities of
being the authoritative format description both for schema-builder
itself and for the JSON schema format that REST API spindle consumes,
as well as being the testdoc for these formats.

Eventually the REST API spindle specification should be extracted to
a separate document, and full test suites should be introduced.

This document is part of the spindle workspace `, pkg("@valos/rest-api-spindle"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`A spindle for structured ValOS REST APIs\`.`,
    ],
  },
  "chapter#introduction>2;Routes, types, and projections": {
    "#0": [
`The four schema builder concepts are:`,
    ],
    "bulleted#1": [
[ref(`Site configuration`, "#section_site_configuration"), ` is the
  JSON output of this library, consumable by REST API spindle.`],
[ref(`Type and property schemas`, "#section_schemas"), ` describe
  layouts of REST API and valospace resources and properties. These are
  used for GET result body contents, POST, PATCH and PUT request body
  fields. When exported in the site configuration these are transformed
  into shared schema objects.`],
[ref(`Routes definitions`, "#section_routes"), ` are the traditional
  tool to define the request entry points and to descrbibe their
  parameters. Routes tie into valospace resources via gate projections
  which are embedded inside primary type schemas.`],
[ref(`Projections and reflections`, "#section_projections"), ` are `,
  ref(`VPaths`, "@valos/raem/VPath"), ` that are embedded in the gates
  and types respectively and which define paths into and between
  valospace resources, respectively`],
    ],
  },
  "chapter#section_site_configuration>3;Site configuration": _createSiteConfigurationChapter(),
  "chapter#section_schemas>4;Type and property schemas": _createSchemasChapter(),
  "chapter#section_routes>5;Route definitions": _createRoutesChapter(),
  "chapter#section_projections>6;Projection and reflection VPaths": _createProjectionsChapter(),
};

runTestDoc();

function _createSiteConfigurationChapter () {
  const createSiteConfiguration = () =>
({
  api: {
    identity: { "!!!": "../../env/test/rest-api-identity" },
    sessionDuration: 86400,
    swaggerPrefix: "/openapi"
  },
  serviceIndex: "valos://site.test.com/site?id=aaaabbbb-cccc",
  openapi: {
    openapi: "3.0.2",
    info: {
      name: "Test API", title: "Test API - Testem",
      description: "", version: "0.1.0",
    },
    externalDocs: {
      url: "https://swagger.io", description: "Find more info here",
    },
    servers: [], host: "0.0.0.0", schemes: ["http", "https"],
    consumes: ["application/json"], produces: ["application/json"],
    tags: [{ name: "user", description: "User end-points" }],
    securityDefinitions: { apiKey: {
      type: "apiKey", name: "apiKey", in: "header",
    } },
  },
  schemas: [
    sharedSchemaOf(TestTagType),
    sharedSchemaOf(TestThingType),
  ],
  routes: [
    sessionGETRoute(`/session`,
        { name: "session", rules: {
          clientRedirectPath: `/`,
          grantExpirationDelay: 300, tokenExpirationDelay: 86400 * 7,
        } }, testGlobalRules),
    sessionDELETERoute(`/session`,
        { name: "session", rules: {
          clientRedirectPath: `/`,
        } }, testGlobalRules),
    listingGETRoute(`/tags`, {}, testGlobalRules, TestTagType),
    resourceGETRoute(`/things/:resourceId`,
        { rules: {
          routeRoot: [],
          resource: ["!$valk:ref", ["!:request:params:resourceId"]],
        } }, testGlobalRules, TestThingType),
    mappingPOSTRoute(`/things/:resourceId/tags`, {
          rules: {
            resource: ["!$valk:ref", ["!:request:params:resourceId"]],
            doCreateMappingAndTarget: ["'",
              ["!:scriptRoot"],
              ["!$valk:invoke:createOES", ["!:oesType"], ["!:resource"],
                ["!:request:body", "$V", "target", "name"]],
            ],
          },
          requiredRules: ["scriptRoot", "oesType"],
        }, testGlobalRules, TestThingType, TestThingType.tags),
  ],
});
  return {
    "#0": [
`Site configuration is the JSON output of this library. It can be
directly assigned as the prefix configuration of the REST API spindle
section of some gateway revela.json. This config contains sections for
the other building blocks.`
    ],
    "example#example_test_global_rules>0;The testGlobalRules shared by the example testdocs":
        blockquote(c(extractExampleText(_createTestGlobalRules))),
    "example#example_site_configuration>1;Example test site configuration":
        blockquote(c(extractExampleText(createSiteConfiguration)))
  };
}

function _createSchemasChapter () {
  return {
    "#0": [
`The main building block of schema-builder is object type schema. In
JSON schema all object properties are listed under 'properties' field
and all meta fields are outermost fields. Schema builder format for
objects lists fields on the outside and properties inside the symbol
field \`[ObjectSchema]\`. The schema expansion will then flip the type
inside out to get the appropriate JSON schema layout.`
    ],
    "example#example_simple_object>0": itExpects(
        "expanded schema of simple object type",
() => exportSchemaOf({
  [ObjectSchema]: {
    description: "simple object type",
    valospace: { reflection: [".:forwardedFields"] },
  },
  name: StringType,
}),
        "toEqual",
() => ({
  description: "simple object type",
  type: "object",
  valospace: { reflection: [".", [":", "forwardedFields"]] },
  properties: { name: { type: "string" } },
})),
    "chapter#extending_schemas>1;Extending schemas": {
      "#0": [
`The schemas can also be extended using `, em("extendType"), `.
The extension is a nested merge and can accept multiple base types.

Here we extend a string type with a valospace reflection path to the
field `, ref("@valos/kernel#name"), `.`,
      ],
      "example#example_schema_extension>2": itExpects(
          "expanded schema of an extended string", [
() => extendType(StringType, { valospace: { reflection: [".$V:name"] } }),
type => exportSchemaOf(type),
          ],
          "toEqual",
() => ({
  type: "string",
  valospace: { reflection: [".", ["$", "V", "name"]] },
})),
    },
    "chapter#resource_type_schemas>2;Shared resource type schemas": {
      "#0": [
`Valospace resources can be named in addition to providing them base
types they extend. A resource that is given a valospace gate are
primary resources which can be directly reached through `,
ref("routes", "#routes"), ` via their projection path.

Schema builder provides a builtin object type \`ResourceType\`
for valospace resources with following JSON schema:`,
blockquote(c(extractExampleText(ResourceType))), `
This type contains the basic valospace selector under the key $V
which contains the resource 'id' field.`,
      ],
      "example#example_named_resources>0": itExpects(
          "expanded schema of a named resource",
[createTestTagType, type => exportSchemaOf(type)],
          "toEqual",
() => ({
  schemaName: "TestTag",
  description: "Test Tag resource",
  type: "object",
  valospace: {
    gate: {
      name: "tags",
      projection: ["@",
        ["out*", [":", "TAG"]], [".", ["$", "V", "target"]],
      ],
    },
  },
  properties: {
    $V: {
      type: "object",
      properties: {
        id: {
          pattern: "^[a-zA-Z0-9\\-_.~]+$",
          type: "string",
          valospace: { reflection: [".", ["$", "V", "rawId"]] }
        },
      },
    },
    name: { summary: "Tag name", type: "string" },
  },
})),
    },
    "chapter#resource_type_references>3;Automatic substitution of shared type references": {
      "#0": [
`The resource types are shared and can be referred to by their name
with a '#'-suffix in the JSON schema. Schema builder does this
automatically during schema generation.`
      ],
      "example#example_named_schema_reference>0": itExpects(
          "expanded schema of a named type reference", [
() => ({ tag: TestTagType }),
type => exportSchemaOf(type),
          ],
          "toEqual", { tag: "TestTag#" },
      ),
    },
    "chapter#mapping_schemas>4;Mapping schemas": {
      "#0": [
`A mapping is group of `, ref("relations", "@valos/kernel#Relation"),
` originating from a resource with a common name. The mapping relations
can have properties and can be referred from the REST API also
individually: their identity (ie. 'primary key') of is the unique
combination of the mapping `, ref("source", "@valos/kernel#source"),
` resource and mapping `, ref("name", "@valos/kernel#name"), ` plus the
individual`, ref("target", "@valos/kernel#target"), ` resource.

The mappings in valospace are defined by a reflection to a set of
relations. Here `, em("mappingToMany"), ` defines a mapping 'tags'
into outgoing TAGS relations with a mapping property 'highlight' and
where the target resource is a Tag type defined earlier.`,
      ],
      "example#example_mapping>0": itExpects(
          "expanded schema of a mapping property", [
() => mappingToManyOf("tags", TestTagType,
    ["out*:TAGS"],
    { highlight: BooleanType }),
type => exportSchemaOf(type),
          ],
          "toEqual",
() => ({
  type: "array",
  valospace: {
    mappingName: "tags",
    reflection: ["out*", [":", "TAGS"]],
  },
  items: {
    type: "object",
    properties: {
      highlight: { type: "boolean" },
      $V: {
        type: "object",
        properties: { href: { type: "string" }, rel: { type: "string" } },
        valospace: { targetType: "TestTag#" }
      },
    },
  },
})),
    },
    "chapter#complex_resource_type5;Putting a complex resource type together": {
      "#0": [
`A complex example which puts all together.`
      ],
      "example#example_complex_resource_type>6": itExpects(
          "expanded schema of a complex resource type",
          [createTestThingType, type => exportSchemaOf(type)],
          "toEqual",
() => ({
  schemaName: "TestThing",
  type: "object",
  valospace: {
    gate: {
      name: "things",
      projection: ["@",
        ["out*", [":", "THING"]], [".", ["$", "V", "target"]],
      ],
    },
    reflection: [".", [":", "fields"]],
  },
  properties: {
    $V: {
      type: "object",
      properties: {
        id: {
          type: "string", pattern: "^[a-zA-Z0-9\\-_.~]+$",
          valospace: { reflection: ["@",
            [".", ["$", "V", "owner"]], [".", ["$", "V", "rawId"]],
          ], },
        },
      },
    },
    contact: {
      email: { type: "string" },
      facebook: { type: "string" },
      linkedin: { type: "string" },
      phone: { type: "string" },
      website: { type: "string" }
    },
    description: { type: "string" },
    icon: { type: "string" },
    image: {
      type: "string",
      valospace: { reflection: [".", ["$", "V", "name"]] },
    },
    name: { type: "string" },
    tags: {
      type: "array",
      valospace: {
        mappingName: "tags",
        reflection: ["@",
          [".", [":", "tags"]], ["out*", [":", "TAG"]]
        ],
      },
      items: {
        type: "object",
        valospace: { filterable: true },
        properties: {
          $V: {
            type: "object",
            valospace: { targetType: "TestTag#" },
            properties: {
              href: { type: "string" }, rel: { type: "string" },
            },
          },
          highlight: { type: "boolean" },
        },
      },
    },
    visible: { type: "boolean" },
  },
})),
    },
  };
}

function _createRoutesChapter () {
  const exampleData = () => ({
    TestTagType,
    TestThingType,
    gate: TestThingType[ObjectSchema].valospace.gate,
    mappingName: "tags",
    testThingTagsMapping: TestThingType.tags,
  });
  const { gate, mappingName, testThingTagsMapping } = exampleData();
  return {
    "#0": [
`Routes are exported as JSON object that is subsequently provided as a `,
ref("fastify route options object", "https://www.fastify.io/docs/latest/Routes/"), `.`
    ],
    "chapter#route_testdoc_examples>1;Route testdoc examples": {
      "#0": [
`Route testdoc examples share the following data:`,
      ],
      "example#example_route_common>0;Data common to all route testdoc examples":
          blockquote(c(extractExampleText(exampleData))),
      "#1": [
`Of note is the \`globalRules\` section, which is a JSON construct that
is sourced from configuration files.`,
      ],
    },
    "chapter#route_basic_get>2;Basic GET resource route": {
      "#0": [
`Simple resource-GET route retrieves a primary TestThingType resource
based on an id string given as a route parameter.

The route defines the reflection rule \`resource\` which converts
the id string into a valospace resource id. The resource-GET handler (a
built-in component of the REST API spindle) then uses this id to pick
the correct resource from the set of resources located by the
TestThingType gate projection.`
      ],
      "example#example_route_get_resource>0": itExpects(
          "route of a simple resource GET",
() => resourceGETRoute(`/${gate.name}/:resourceId`, {
  rules: {
    routeRoot: null,
    resource: ["!$valk:ref", ["!:request:params:resourceId"]],
  },
}, {}, TestThingType),
          "toEqual",
() => ({
  name: "things", method: "GET", category: "resource",
  url: "/things/:resourceId",
  schema: {
    description: "Get the contents of a TestThing route resource",
    querystring: { fields: {
      type: "string",
      pattern: "^([a-zA-Z0-9\\-_.~/*$]*(\\,([a-zA-Z0-9\\-_.~/*$])*)*)?$"
    }, },
    response: {
      200: "TestThing#",
      404: { type: "string" }
    }
  },
  config: {
    requiredRules: ["routeRoot", "resource"],
    resource: {
      name: "TestThing",
      schema: "TestThing#",
      gate: {
        name: "things",
        projection: ["@",
          ["out*", [":", "THING"]], [".", ["$", "V", "target"]],
        ],
      },
    },
    rules: {
      resource: ["!", ["$", "valk", "ref"],
        ["!", [":", "request"], [":", "params"], [":", "resourceId"]]
      ],
      routeRoot: null,
    },
  },
})),
  },
    "chapter#route_complex_post_mapping>3;Complex POST mapping route": {
      "#0": [
`Complex mapping-POST route which adds a new tags mapping to a primary
thing.`
      ],
      "example#example_route_post_mapping>0": itExpects(
          "route of a complex POST mapping",
() => mappingPOSTRoute(`/${gate.name}/:resourceId/${mappingName}`, {
  rules: {
    resource: ["!$valk:ref", ["!:request:params:resourceId"]],
    doCreateMappingAndTarget: ["'",
      ["!:scriptRoot"],
      ["!$valk:invoke:createOES", ["!:oesType"], ["!:resource"],
        ["!:request:body", "$V", "target", "name"],
      ],
    ]
  },
  requiredRules: ["scriptRoot", "oesType"],
}, testGlobalRules, TestThingType, testThingTagsMapping),
          "toEqual",
() => ({
  name: "things", method: "POST", category: "mapping",
  url: "/things/:resourceId/tags",
  schema: {
    description:
`Create a new TestTag resource
*using **body.$V.target** as content* and then a new 'tags'
mapping to it from the source TestThing route
resource. The remaining fields of the body are set as the mapping
content. Similarily the response will contain the newly created target
resource content in *response.$V.target* with the rest of the response
containing the mapping.`,
    body: {
      type: "object",
      valospace: { filterable: true },
      properties: {
        $V: {
          type: "object",
          valospace: { targetType: "TestTag#" },
          properties: {
            href: { type: "string" }, rel: { type: "string" },
          },
        },
        highlight: { type: "boolean" },
      },
    },
    querystring: undefined,
    response: {
      200: {
        type: "object",
        valospace: { filterable: true },
        properties: {
          $V: {
            type: "object",
            valospace: { targetType: "TestTag#" },
            properties: {
              href: { type: "string" },
              rel: { type: "string" },
              target: "TestTag#",
            },
          },
          highlight: { type: "boolean" },
        },
      },
      403: { type: "string" }
    }
  },
  config: {
    resource: {
      name: "TestThing",
      schema: "TestThing#",
      gate: {
        name: "things",
        projection: ["@",
          ["out*", [":", "THING"]], [".", ["$", "V", "target"]],
        ],
      },
    },
    relation: {
      name: "tags",
      schema: {
        type: "array",
        valospace: {
          mappingName: "tags",
          reflection: ["@",
            [".", [":", "tags"]], ["out*", [":", "TAG"]],
          ]
        },
        items: {
          type: "object",
          valospace: { filterable: true },
          properties: {
            $V: {
              type: "object",
              valospace: { targetType: "TestTag#" },
              properties: {
                href: { type: "string" }, rel: { type: "string" },
              },
            },
            highlight: { type: "boolean" }
          },
        },
      },
    },
    target: { name: "TestTag", schema: "TestTag#" },
    requiredRules: [
      "routeRoot", "resource", "doCreateMappingAndTarget",
      "scriptRoot", "oesType",
    ],
    rules: {
      doCreateMappingAndTarget: ["'",
        ["!", [":", "scriptRoot"]],
        ["!", ["$", "valk", "invoke"], [":", "createOES"],
          ["!", [":", "oesType"]],
          ["!", [":", "resource"]],
          ["!", [":", "request"], [":", "body"], [":", "$V"],
            [":", "target"], [":", "name"]],
        ]
      ],
      oesType: "tag",
      resource: ["!", ["$", "valk", "ref"],
        ["!", [":", "request"], [":", "params"], [":", "resourceId"]]
      ],
      routeRoot: ["$", "~u4", "aaaabbbb-cccc-dddd-eeee-ffffffffffff"],
      scriptRoot: ["$", "~gh", "0123456789abcdef"],
    },
  },
})),
    },
  };
}

function _createProjectionsChapter () {
  const createExampleData = () => ({ shared: "shared example data example" });
  // const { shared } = createExampleData();
  return {
    "#0": [
`Projections and reflections are `, ref("vpath", "@valos/raem/VPath"), `
which are present primary type \`valospace.gate.projection\` fields and
in type and property \`valospace.reflection\` fields.`
    ],
    "chapter#projections_testdoc_examples>1;Projections examples": {
      "#0": [
`Projections testdoc examples share the following data:`,
      ],
      "example#example_projections_common>0;Data common to all projections examples":
          blockquote(c(extractExampleText(createExampleData))),
    },
  };
}
