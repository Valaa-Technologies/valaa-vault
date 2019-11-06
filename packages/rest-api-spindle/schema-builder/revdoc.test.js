const {
  extractee: {
    c, blockquote, authors, em, ref, pkg,
    prepareTestDoc,
  },
} = require("@valos/revdoc");

const {
  BooleanType, ObjectSchema, StringType, ResourceType, extendType, mappingToManyOf,
  generateSchemaOf
} = require("./types");

const {
  createTestTagType, TestTagType, createTestThingType
} = require("../test/test-types");

const title = "REST API Schema Builder TestDoc";
const { itExpects, runTestDoc } = prepareTestDoc(title);

module.exports = {
  "dc:title": title,
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "restSchemaBuilder",
  },
  "chapter#abstract>0": {
    "#0":
`REST API schema builder is a javascript library for generating the
full REST API spindle JSON schema mapping definition. This definition
is specified using convenient types and routes which have the valospace
projections embedded as fine-grained VPaths.`,
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the spindle workspace `, pkg("@valos/rest-api-spindle"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`A spindle for structured ValOS REST APIs\`.`,
    ],
  },
  "chapter#introduction>2;Routes, types, and projections": {
    "#0": [
`The three schema builder concepts are:`,
    ],
    "bulleted#1": [
[`Types describe layouts of valospace resources and their properties.
  These are used for GET result body contents, POST, PATCH and PUT
  request body fields.`],
[`Routes are the traditional tool to define request entry points and
  to descrbibe their parameters. Routes tie into primary resources via
  gates which define the entry points to valospace resources.`],
[`Reflections are VPaths embedded in the type schemas which define the
  mappings into and between valospace resources. Gates specify entry
  reflections called projections which define the initial entry paths
  to valospace.`],
    ],
  },
  "chapter#types>3;Type schemas": {
    "#0": [
`The main building block of is the object type schema. In JSON schema
all object properties are listed under 'properties' field and all meta
fields are outermost fields. Schema builder format for objects lists
fields on the outside and properties inside the symbol field
\`[ObjectSchema]\`. The schema expansion will then flip the type
inside out to get the appropriate JSON schema layout.`
    ],
    "example#example_simple_object>0": itExpects(
        "expanded schema of simple object type",
() => generateSchemaOf({
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
            type => generateSchemaOf(type),
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
blockquote(c(JSON.stringify(ResourceType, null, 2))), `
This type contains the basic valospace selector under the key $V
which contains the resource 'id' field.`,
      ],
      "example#example_named_resources>0": itExpects(
          "expanded schema of a named resource",
          [createTestTagType, type => generateSchemaOf(type)],
          "toEqual",
() => ({
  schemaName: "TestTag",
  description: "Test Tag resource",
  type: "object",
  valospace: {
    gate: {
      name: "tags",
      projection: ["@", ["out*", [":", "TAG"]], [".", ["$", "V", "target"]]],
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
          "expanded schema of a named type reference",
          [() => ({ tag: TestTagType }), type => generateSchemaOf(type)],
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
() => mappingToManyOf("tags", TestTagType, ["out*:TAGS"], { highlight: BooleanType }),
type => generateSchemaOf(type),
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
        valospace: { TargetType: "TestTag#" }
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
          [createTestThingType, type => generateSchemaOf(type)],
          "toEqual",
() => ({
  schemaName: "TestThing",
  type: "object",
  valospace: {
    gate: {
      name: "things",
      projection: ["@", ["out*", [":", "THING"]], [".", ["$", "V", "target"]]],
    },
    reflection: [".", [":", "fields"]],
  },
  properties: {
    $V: {
      type: "object",
      properties: {
        id: {
          type: "string", pattern: "^[a-zA-Z0-9\\-_.~]+$",
          valospace: {
            reflection: ["@", [".", ["$", "V", "owner"]], [".", ["$", "V", "rawId"]]],
          },
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
    owned: {
      news: {
        type: "array",
        valospace: {
          mappingName: "owned/news",
          reflection: ["@", [".", [":", "owned"]], ["out*", [":", "NEWSITEM"]]],
        },
        items: {
          type: "object",
          properties: {
            $V: {
              type: "object",
              valospace: { TargetType: "TestNewsItem#" },
              properties: { href: { type: "string" }, rel: { type: "string" } },
            },
            highlight: { type: "boolean" },
          },
        },
      },
    },
    tags: {
      type: "array",
      valospace: {
        mappingName: "tags",
        reflection: ["@", [".", [":", "tags"]], ["out*", [":", "TAG"]]],
      },
      items: {
        type: "object",
        valospace: { filterable: true },
        properties: {
          $V: {
            type: "object",
            valospace: { TargetType: "TestTag#" },
            properties: { href: { type: "string" }, rel: { type: "string" } },
          },
        },
      },
    },
    visible: { type: "boolean" },
  },
})),
    },
  },
};

runTestDoc();
