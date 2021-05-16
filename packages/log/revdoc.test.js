const {
  extractee: {
    c, authors, jsonld, em, ref, pkg, regexp,
    prepareTestDoc,
  },
} = require("@valos/revdoc");

const { baseStateContext, baseStateContextText, createVState } = require("@valos/state");
const { applyVLogDeltaToState } = require("@valos/log");

const title = "VLog format specification";
const { itExpects, runTestDoc } = prepareTestDoc(title);

let state = createVState();

/* eslint-disable quote-props */

module.exports = {
  "dc:title": title,
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors("iridian"),
    shortName: "VLog",
  },

  "chapter#abstract>0": {
    "#0": [
`ValOS log ('VLog') format specifies the ontology, the format and the
algorithms for expressing a ValOS chronicle change event history as a
sequence of`, ref("VState", "@valos/state"), `-formatted JSON-LD
document entries.`,
    ],
  },

  "chapter#sotd>1": {
    "#0": [
`This document speficies the event delta structure and semantics via
declarative examples.

This document is part of the library workspace `, pkg("@valos/log"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`VLog specification and reference implementation\`.`,
    ],
  },

  "chapter#introduction>2": {
    "#0": [
`A VLog event is a specifically structured JSON-LD document that
represents a change between two VState documents. The document contains
several sub-components, `, ref("aspects", "#section_aspects"),  ` that
contain `, ref("the delta payload", "#section_delta_aspect"), ` itself
but also metadata, validations and other lifetime attribute of the
event.`,
null,
`The delta aspect is a semantically incomplete precursor of the actual
triples that are added to (or removed from) the vstate graph itself. To
complete the precursor the accumulated state @context `,
ref("URI mappings", "#section_uri_mappings"), ` must be added to the
delta root context.`,
    ],
  },

  "chapter#principles>3;General principles": {
    "#0": [
`General design concepts, aims and ideas and out-right in a mish-mash
wish-list:`,
      { "bulleted#0": [
[`Each event is a named graph with a name that is a monotonically
  increasing vplot-name derived based on the chronicle id itself.`],
[`Event graphs are thus disjoint when flattened.`],
[`Reduction is the process of applying the events in succession from
  the very beginning of the VLog and yields a snapshot vstate graph.`],
[`Reduction consists of validation, separation and update steps.`],
[`Validation rejects heretical events. Separation removes event
  metadata and splits the remaining payload to separate update stages.
  Update applies these parts to state.`],
[`Separation and update should be computationally simple, naive even,
  as they are unavoidable and often heavily repeated.`],
[`Validation can often be selectivelly waived by secondary consumers or
  sub-sequent event log consumption runs and thus can be incrementally
  (if not outrageously) costlier that the other steps.`],
[`Event payload should be bytewise minimal. VLogs can appear anywhere
  and compression aint free either.`],
[`Event payload should be as flat as possible to facilitate easy
  introspection APIs`],
[`Events must be valid and internally consistent JSON-LD even in
  isolation but they don't need to be semantically complete.`],
[`Events need to be semantically complete when evaluated using the
  accumulated parent context of all previous VLog events.`
  // Won't get semantical completeness. Hierarchical VPlot references
  // will be broken before the implicit local contexts are added.
  ],
[`Cryptographical signing of event payloads by user signatures should
  be simple.`],
[`Event creators can specify crypto-behaviors that add validateable
  constraints to the future VLog operations.`],
[`Constraints can be used to limit the addition of new
  crypto-behaviors`],
[`Reordering of events by VLog authorities should be possible whenever
  it can be proven that reordering doesn't change essential semantics`],
[`Event creators can specify what is considered essential semantics by
  crypto-behaviors`],
[`Dual construct is a triple which is directly 'reified' by a resource
  in the same named graph. Properties and Relations have dual nature.`],
  // Dual constructs are the domain of vstate spec. VLog doesn't need
  // to know about it.
      ] },
``
    ],
  },

  "chapter#examples>6;Examples": {
    "#0": [
`The examples use the standard context as the initial starting context.
Each successive example uses the output state of the previous example
as its input state.`
    ],
    "example#>0;Initial state @context": jsonld(baseStateContextText),
    "#1": [
`VLog events have a so-called "@context IRI index" which maps integer
strings into IRI values. The first three indexes have special,
restricted semantics.

The IRI index "0" contains the chronicle id of the chronicle root
resource in its vplot form: this resource shall be created by the first
VLog event.

The IRI index "1" contains the chronicle URI. This is constructed as
per the rules of the authority scheme from the authority URI and
chronicle id.

The IRI index "2" contains the authority URI of the chronicle. This
shall be set as the V:authorityURI value of the root resource. Keep in
mind that the definition of a new chronicle is the creation of a global
resource which has its V:authorityURI set (or its assignment to an
existing global resource) and denotes the beginning of the event log.

When the event delta is applied the state is updated as defined by the
event delta. In addition to this the event itself may be preserved in
the state. Various JSON-LD aware fields are also added to the state
complete the RDF data model projection.
`,
    ],
    "example#>1": itExpects(
        "creates chronicle root entity",
() => JSON.parse(JSON.stringify(state = applyVLogDeltaToState(
    state = createVState({ ontologies: { V, VLog, VState } }), {
  "@context": [{
    "0": "~u4:cccccccc-6600-2211-cc77-333333333333/",
    "1": "valos://localhost/~u4!cccccccc-6600-2211-cc77-333333333333/",
    "2": "valos://localhost/"
  }],
  "&/": {
    "0:": { ".n": "rootName", ".cURI": "1:", ".aURI": "2:",  }
  },
  "aspects": {
    "log": { index: 0 },
  },
}))),
        "toMatchObject",
() => ({
  "@context": [...baseStateContext, {
    "0": "~u4:cccccccc-6600-2211-cc77-333333333333/",
    "1": "valos://localhost/~u4!cccccccc-6600-2211-cc77-333333333333/",
    "2": "valos://localhost/"
  }],
  "state": {
    "0:": { ".n": "rootName", ".cURI": "1:", ".aURI": "2:" },

    // chronicle event introspection
    "1:": {
      "@context": {                    // base URI set to the chronicle URI ...
        "@base": "valos://localhost/~u4!cccccccc-6600-2211-cc77-333333333333/"
      },
      "events": {
        "-log!a0/": {                  // ... so that event graphs can be relative to it ...
          "@context": [{
            "@base": "-log!a0/",       // ... and their contents based on it
          }, {
            "0": "~u4:cccccccc-6600-2211-cc77-333333333333/",
            "1": "valos://localhost/~u4!cccccccc-6600-2211-cc77-333333333333/",
            "2": "valos://localhost/"
          }],
          ".ng": "-log:a0",            // event name added
          "&t": "VState:DeltaAspect", // event type added
          "&/": { "0:": { ".n": "rootName", ".cURI": "1:", ".aURI": "2:" } },
          "aspects": {
            "log": { index: 0 }
          }
        }
      }
    }
  }
}),
    ),
    "#2": [
`ValOS resources have singular owners and form a logical ownership tree
hierarchy. This hierarchy determines various resource behaviors and
lifetimes: effects and rules that affect an owner can often affect its
children well.
Some of these resources have a globally unique identifier which doesn't
contain information about their ownership hierarchy. This allows their
ownership to be freely changed.

These global identifiers are stored in the IRI index. Deltas that
modify these resources are identified simply by the <index>: -notation.

However as the logical path is relevant for the resource behaviors it
must be included as the value of the delta-term "!~" in all
global resource delta objects.

Note: unlike other terms, the "!"-prefixed terms (ie. apply-terms) are
mutated or removed during delta application and don't have a persisted
representation on their own.

The logical plot is a "/"-separated and -terminated string where each
step is an IRI index of resource. Each step owns the resource to its
right. The first step with is implicitly always "0" (the chronicle root
resource) is omitted.

The logical plot must be equal to the ownership hierarchy of the
resource as determined by the previous events and/or state. Event
processors which can validate the logical plot must do so and reject
invalid events. This allows processors (naive proxies, filters etc.)
which cannot validate the logical plot to still rely on it for
determining behaviors.
  `,
// TODO(iridian, 2021-03): Move this section to a proper location in
// the @valos/state revdoc
`VLog node objects have chronicle-local vplot identifiers. A local
vplot id begins with `, c("vplot:chronicle/"), ` and is followed by a `,
ref("route-vplot", "@valos/vplot#route-vplot"), ` string. Each vterm of
the local vplot id that matches the pattern `, regexp("[0-9]+"), `
maps to a URI in the chronicle URI lookup. The local vplot id can be
translated to a global valos:urn vplot id by replacing all the mappings
with their corresponding URI and converting the id to `,
ref("urn-vplot", "@valos/vplot#urn-vplot"), ` form.

These local vplot ids form a nested hierarchy. Resource views project
subtrees of this hierarchy (`, em("view origin"), `) to be accessible
at other subtree locations (`, em("view image"), `). Notably, ownership
views project the stable root-level embodiment of a resource (`,
em("stable origin"), `) to be accessible at its current logical
location in the ownership hierarchy (`, em("logical image"), `).

Delta updates to resources must always be applied to the logical
image, never to the resource origin itself (unless they're the
same). Similarily, references in deltas must refer to logical images
as long as the referenced resource belongs to the same chronicle.

Conversely, the state of a resource is always represented at the
stable origin. Similarily, all references in state objects must refer
to the stable origins of the resources.

All references (in both deltas and state alike) to resources in other
chronicles must refer to their stable origin.
.`
    ],
    "example#>2": itExpects(
        "delta application to harmonize refs to appropriate stable origin refs",
() => JSON.parse(JSON.stringify(state = applyVLogDeltaToState(state,
{
  "@context": [{
    "3": "~u4:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "4": "~u4:bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "5": "~u4:abababab-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "6": "~u4:babababa-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "7": "valaa-test:?id=(~raw'extl!)#"
  }],
  "&/": {
    "0:": { ".n": "newRootName" },
    "1/": { ".E~": "0/", ".n": "older",
      "toOutside": { "@id": "5/" }, "absolutelyParent": { "@id": "/0/" },
    },
    "2/": { ".E~": "0/", ".n": "unger",
      "toOlder": { "@id": "1/" }, "absolutelyOlder": { "@id": "/1/" },
    },
    "2/3/": { ".tgt~": "2/", ".n": "SIBLING", ".src": "1/" },
    "2/4/": { ".src~": "2/", ".n": "SIBLING", ".tgt": "1/" },
  },
}))),
        "toMatchObject",
() => ({
  "@context": [...baseStateContext, {
    "0": "~u4:cccccccc-6600-2211-cc77-333333333333/",
    "1": "valos://localhost/~u4!cccccccc-6600-2211-cc77-333333333333/",
    "2": "valos://localhost/",
    "3": "~u4:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "4": "~u4:bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "5": "~u4:abababab-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "6": "~u4:babababa-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "7": "valaa-test:?id=(~raw'extl!)#"
  }],
  "state": {
    "0:": { ".n": "newRootName",
      ".cURI": "1:", ".aURI": "2:",
      "~E": ["3:", "4:"],
    },
    "1/": { ".E~": "0/", ".n": "older",
      "-out": ["3/"], "-in": ["4/"],
      "toOutside": { "@id": "5/" }, "absolutelyParent": { "@id": "/0/" }
    },
    "2/": { ".E~": "0/", ".n": "unger",
      "~R": ["3/", "4/"],
      "-out": ["4/"], "-in": ["3/"],
      toOlder: { "@id": "1/" }, "absolutelyOlder": { "@id": "/1/" }
    },
    "3/": { ".tgt~": "2/", ".n": "SIBLING", ".src": "1/" },
    "4/": { ".src~": "2/", ".n": "SIBLING", ".tgt": "1/" },
  },
}
    ),
    "#3": [`
Ghost instancing with `, ref("V:instanceOf"), ` term ".iOf" and the
recursive application of the `, ref("VState:subResources"),
` term '&/' are the cornerstone of the unified valos resource model for
application development.

Instancing dynamics primarily affects state inference and as such no
additional functionality for deltas is necessary. It should be noted
however that the logical image vplot of ghosts 'flattens' the stable
origin vplot of its ghost prototype (See how resource "0/3/5/10" is
ghosted as "0/8/10" and "0/9/10"). Instance views behave here similar to
external references: the ghost vplot cannot know the exact logical
location of its prototype (not least because the prototype might be
in a different chronicle!).
`],
    "example#>3": itExpects(
        "instances a resource with ghosts",
() => JSON.parse(JSON.stringify(state = applyVLogDeltaToState(state,
{
  "@context": [{
    "8": "~u4:11111111-2255-7744-22cc-eeeeeeeeeeee/",
    "9": "~u4:22222222-2255-7744-22cc-eeeeeeeeeeee/",
    "10": "~u4:d336d336-9999-6666-0000-777700000000/"
  }],
  "&/": {
    "2/3/8/": { ".E~": "3/", ".n": "deeplyOwned" },
    "6/": {
      ".E~": "0/", ".iOf": "2/", ".n": "ungerInstance",
      "&_": {
        "6/3/": {
          "instance": { "@id": "6/" },
          "absoluteInstance": { "@id": "/6/" },
          "deepProto": { "@id": "8/" },
          "absoluteDeepProto": { "@id": "/8/" },
        },
        "6/8/": { ".n": "deeplyOwnedGhost" },
      },
    },
    "7/": {
      ".E~": "0/", ".iOf": "6/", ".n": "ungerInstanceInstance",
      "&_": {
        "7/3/": { "instanceInstance": { "@id": "7/" } },
        "7/8/": { ".n": "deeplyOwnedGhostGhost" },
      },
    },
  },
}))),
        "toMatchObject",
() => ({
  "@context": [...baseStateContext, {
    "0": "~u4:cccccccc-6600-2211-cc77-333333333333/",
    "1": "valos://localhost/~u4!cccccccc-6600-2211-cc77-333333333333/",
    "2": "valos://localhost/",
    "3": "~u4:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "4": "~u4:bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "5": "~u4:abababab-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "6": "~u4:babababa-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "7": "valaa-test:?id=(~raw'extl!)#",
    "8": "~u4:11111111-2255-7744-22cc-eeeeeeeeeeee/",
    "9": "~u4:22222222-2255-7744-22cc-eeeeeeeeeeee/",
    "10": "~u4:d336d336-9999-6666-0000-777700000000/"
  }],
  "state": {
    "0:": { ".n": "newRootName",
      ".cURI": "1:", ".aURI": "2:",
      "~E": ["3:", "4:", "8:", "9:"]
    },
    "1/": { ".E~": "0/", ".n": "older",
      "-out": ["3/"], "-in": ["4/"],
      "toOutside": { "@id": "5/" }, "absolutelyParent": { "@id": "/0/" }
    },
    "2/": { ".E~": "0/", ".n": "unger",
      "~R": ["3/", "4/"],
      "-out": ["4/"], "-in": ["3/"], "-hasI": ["6/"],
      "toOlder": { "@id": "1/" }, "absolutelyOlder": { "@id": "/1/" }
    },
    "3/": { ".tgt~": "2/", ".n": "SIBLING", ".src": "1/", "~E": ["8/"] },
    "4/": { ".src~": "2/", ".n": "SIBLING", ".tgt": "1/" },
    "6/": [{ ".E~": "0/", ".n": "ungerInstance",
      ".iOf": "2/", "-hasI": ["7/"],
    }, {
      "@context": { "@base": "6/" },
      "&_": {
        "3/": {
          "instance": { "@id": "" },
          "absoluteInstance": { "@id": "/6/" },
          "deepProto": { "@id": "../8/" },
          "absoluteDeepProto": { "@id": "/8/" },
        },
        "8/": { ".n": "deeplyOwnedGhost" }
      }
    }],
    "7/": [{ ".E~": "0/", ".n": "ungerInstanceInstance",
      ".iOf": "6/",
    }, {
      "@context": { "@base": "7/" },
      "&_": {
        "3/": { "instanceInstance": { "@id": "" }, },
        "8/": { ".n": "deeplyOwnedGhostGhost" }
      }
    }],
    "8/": { ".E~": "3/", ".n": "deeplyOwned" },
  },
}),
    ),
    "#4": [`
Projection views are the underlying mechanism on top of which the
instancing is built. Projection views project virtual, inferred copies
of their origin subtrees to their view location. An instancing ".iOf"
property creates such a projection from the prototype (as the origin)
onto the instance (as view) itself.

This virtual copying is lexical: projected relative references will now
refer to the relative resources inside the instance view instead of
to the originally referenced resources within the prototype. Conversely,
absolute references (ie. those that begin with "/") keep refering to
to the same resources even when projected.

The normalized vplot base of a relative reference that appears in the
body of some resource is the vplot id of the `, em("parent"), ` of that
resource. References that appear in a delta can be based arbitrarily
however: the delta application will perform this reference normalization.
`],
    "example#>4": itExpects(
        "complex vplot relative references to be normalized",
() => JSON.parse(JSON.stringify(state = applyVLogDeltaToState(state,
{
  "@context": [{
    "11": "~u4:77777777-1111-eeee-3333-555555555555/",
  }],
  "&/": {
    "9/": {
      ".E~": "0/", ".n": "inceptor", ".iOf": "0/",
      "&_": {
        "9/1/": { ".n": "olderGhost" },
        "9/2/": { ".n": "ungerGhost" },
        "9/3/": { ".n": "toNephewOldceptGhost", ".tgt": "9/9/1/" },
        "9/4/": { ".n": "toNephewUngceptGhost", ".tgt": "9/9/2/" },
        "9/9/": { ".n": "firstInception" },
        "9/9/1/": { ".n": "oldceptGhost" },
        "9/9/2/": { ".n": "ungceptGhost" }
      }
    },
  },
}))),
        "toMatchObject",
() => ({
  "@context": [...baseStateContext, {
    "0": "~u4:cccccccc-6600-2211-cc77-333333333333/",
    "1": "valos://localhost/~u4!cccccccc-6600-2211-cc77-333333333333/",
    "2": "valos://localhost/",
    "3": "~u4:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "4": "~u4:bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "5": "~u4:abababab-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "6": "~u4:babababa-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "7": "valaa-test:?id=(~raw'extl!)#",
    "8": "~u4:11111111-2255-7744-22cc-eeeeeeeeeeee/",
    "9": "~u4:22222222-2255-7744-22cc-eeeeeeeeeeee/",
    "10": "~u4:d336d336-9999-6666-0000-777700000000/",
    "11": "~u4:77777777-1111-eeee-3333-555555555555/"
  }],
  "state": {
    "0/": { ".n": "newRootName",
      "V:authorityURI": "valaa-local:",
      "~E": ["1/", "2/", "6/", "7/", "9/"]
    },
    "1/": { ".E~": "0/", ".n": "older",
      "-out": ["3/"], "-in": ["4/"],
      "toOutside": { "@id": "5/" }, "absolutelyParent": { "@id": "/0/" }
    },
    "2/": { ".E~": "0/", ".n": "unger",
      "~R": ["3/", "4/"],
      "-out": ["4/"], "-in": ["3/"], "-hasI": ["6/"],
      "toOlder": { "@id": "1/" }, "absolutelyOlder": { "@id": "/1/" }
    },
    "3/": { ".tgt~": "2/", ".n": "SIBLING", ".src": "1/", "~E": ["8/"] },
    "4/": { ".src~": "2/", ".n": "SIBLING", ".tgt": "1/" },
    "6/": [{ ".E~": "0/", ".n": "ungerInstance",
      ".iOf": "2/", "-hasI": ["7/"]
    }, {
      "@context": { "@base": "6/" },
      "&_": {
        "3/": {
          "instance": { "@id": "" },
          "absoluteInstance": { "@id": "/6/" },
          "deepProto": { "@id": "../8/" },
          "absoluteDeepProto": { "@id": "/8/" }
        },
        "8/": { ".n": "deeplyOwnedGhost" }
      }
    }],
    "7/": [{ ".E~": "0/", ".n": "ungerInstanceInstance",
      ".iOf": "6/"
    }, {
      "@context": { "@base": "7/" },
      "&_": {
        "3/": { "instanceInstance": { "@id": "" } },
        "8/": { ".n": "deeplyOwnedGhostGhost" }
      }
    }],
    "8/": { ".E~": "3/", ".n": "deeplyOwned" },
    "9/": [{ ".E~": "0/", ".n": "inceptor", ".iOf": "0/" }, {
      "@context": { "@base": "9/" },
      "&_": {
        "1/": { ".n": "olderGhost" },
        "2/": { ".n": "ungerGhost" },
        "3/": { ".n": "toNephewOldceptGhost", ".tgt": "9/1/" },
        "4/": { ".n": "toNephewUngceptGhost", ".tgt": "9/2/" },
        "9/": [{
          ".n": "firstInception",
        }, {
          "@context": { "@base": "9/" },
          "&_": {
            "1/": { ".n": "oldceptGhost", "-in": ["../3/"] },
            "2/": { ".n": "ungceptGhost", "-in": ["../4/"] }
          }
        }],
      }
    }]
  },
}),
    ),
    "#5": [`
Resource deletion is done by adding the removed triples to the removal
graphs via `, ref("VState:removes"), ` term "&-".

Triple removals from various container properties are persisted in the
state in any resources that can be view images, as these removals are
then continuously applied to a the possible corresponding inherited
view container properties.
`],
    "example#>5": itExpects(
        "resource deletions to be persisted in state",
() => JSON.parse(JSON.stringify(state = applyVLogDeltaToState(state,
{
  "&/": {
    "9/": { "&_": {
      "9/4/": { "&-": { ".tgt": "9/9/2/" } },
      "9/9/": { "&-": { "&_": ["9/9/2/"], "~E": ["9/9/2/"] } },
    }, },
  },
}))),
        "toMatchObject",
() => ({
  "@context": [...baseStateContext, {
    "0": "~u4:cccccccc-6600-2211-cc77-333333333333/",
    "1": "valos://localhost/~u4!cccccccc-6600-2211-cc77-333333333333/",
    "2": "valos://localhost/",
    "3": "~u4:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "4": "~u4:bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "5": "~u4:abababab-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "6": "~u4:babababa-bbbb-cccc-dddd-eeeeeeeeeeee/",
    "7": "valaa-test:?id=(~raw'extl!)#",
    "8": "~u4:11111111-2255-7744-22cc-eeeeeeeeeeee/",
    "9": "~u4:22222222-2255-7744-22cc-eeeeeeeeeeee/",
    "10": "~u4:d336d336-9999-6666-0000-777700000000/",
    "11": "~u4:77777777-1111-eeee-3333-555555555555/"
  }],
  "state": {
    "0:": { ".n": "newRootName",
      ".cURI": "1:", ".aURI": "2:",
      "~E": ["3:", "4:", "8:", "9:", "11:"]
    },
    "1/": { ".E~": "0/", ".n": "older",
      "-out": ["3/"], "-in": ["4/"],
      "toOutside": { "@id": "5/" }, "absolutelyParent": { "@id": "/0/" }
    },
    "2/": { ".E~": "0/", ".n": "unger",
      "~R": ["3/", "4/"],
      "-out": ["4/"], "-in": ["3/"], "-hasI": ["6/"],
      "toOlder": { "@id": "1/" }, "absolutelyOlder": { "@id": "/1/" }
    },
    "3/": { ".tgt~": "2/", ".n": "SIBLING", ".src": "1/", "~E": ["8/"] },
    "4/": { ".src~": "2/", ".n": "SIBLING", ".tgt": "1/" },
    "6/": [{ ".E~": "0/", ".n": "ungerInstance",
      ".iOf": "2/", "-hasI": ["7/"]
    }, {
      "@context": { "@base": "6/" },
      "&_": {
        "3/": {
          "instance": { "@id": "" },
          "absoluteInstance": { "@id": "/6/" },
          "deepProto": { "@id": "../8/" },
          "absoluteDeepProto": { "@id": "/8/" }
        },
        "8/": { ".n": "deeplyOwnedGhost" }
      }
    }],
    "7/": [{ ".E~": "0/", ".n": "ungerInstanceInstance",
      ".iOf": "6/"
    }, {
      "@context": { "@base": "7/" },
      "&_": {
        "3/": { "instanceInstance": { "@id": "" } },
        "8/": { ".n": "deeplyOwnedGhostGhost" }
      }
    }],
    "8/": { ".E~": "3/", ".n": "deeplyOwned" },
    "9/": [{ ".E~": "0/", ".n": "inceptor", ".iOf": "0/" }, {
      "@context": { "@base": "9/" },
      "&_": {
        "1/": { ".n": "olderGhost" },
        "2/": { ".n": "ungerGhost" },
        "3/": { ".n": "toNephewOldceptGhost", ".tgt": "9/1/" },
        "4/": { ".n": "toNephewUngceptGhost" },
        "9/": [{
          ".n": "firstInception",
          "&-": { "~E": ["9/2/"] },
        }, {
          "@context": { "@base": "9/" },
          "&_": {
            "1/": { ".n": "oldceptGhost", "-in": ["../3/"] }
          }
        }],
      }
    }],
  },
}),
    ),
  },
};

runTestDoc();
