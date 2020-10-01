const { ref } = require("@valos/revdoc/extractee");
const { buildNamespaceSpecification } = require("@valos/tools/namespace");

module.exports = buildNamespaceSpecification({
  domain: "@valos/kernel",
  preferredPrefix: "On",
  baseIRI: "https://valospace.org/inspire/On/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    V: "@valos/space/V",
    Lens: "@valos/inspire/Lens",
  },
  description: [
`The ValOS 'On' namespace provides the event handler names used by
ValOS gateway both within fabric and valospace addEventHandler calls.`,
null,
`Like HTML5 events these callbacks are called with a synthetic event as
their first argument.`,
`The namespace contains all new event names introduced by `, ref("valos kernel", "@valos/kernel"),
` but also inherits all HTML5 event names verbatim.`,
null,
`Note: ValOS event names will not conflict with currently known web
event names and effort is made to ensure that there are no future
conflicts either. However should new web API event names conflict with
valos names the ValOS event names take primacy. Conflicting web event
names are then made available in the 'On' namespace with "web" text as
a prefix.`,
  ],
  declareNames,
  processDeclaration (name, declaration, { addLabel }) {
    addLabel(`On:${name}`, `On:${name}`, ["When used as ", ref("Lens:Element"), " attribute"]);
    addLabel(`addEventListener("${name}", ...)`, undefined, "When used on Valoscript event target");
    /*
    const componentType = declaration.tags.includes("Transactor") ? "Lens:Valoscope"
        : declaration.tags.includes("Fabricator") ? "Lens:Element"
        : null;
    // ff = "VSheath:FabricatorEvent";
    // target = "Transactor";
    */
  },
});

function declareNames ({ declareName }) {
  declareName("issue", {
    tags: ["Transactor", "FabricEvent"],
    type: "EventHandler",
    description: [
`Fired at a transactor when its transaction commit has been issued and
its command is about to be fast-forward professed into a prophecy as
part of the current recital.`,
null,
`This event is fired only during the initial commit and even then only
if the command does not need to be replayed (otherwise 'replay' is
fired at the transaction ).`,
null,
`If the event defaultAction is canceled or an exception is thrown then
the transaction is immediately rejected without recital and the fabric
commit will throw an exception.`
    ],
    bubbles: true,
    cancelable: true,
  });
  declareName("replay", {
    tags: ["Transactor", "FabricEvent"],
    type: "EventHandler",
    description: [
`Fired at a transactor when the history of a prophecy has been revised
and the command is about to be replayed and then professed into a
prophecy as part of the current recital.`,
null,
`This event can be fired during the initial chronicle commit (if it
can't be fast-forwarded) but also during later revision and reformation
replays.`,
null,
`If the event defaultAction is canceled or an exception is thrown then
the replay recital of this command is rejected. If this event was fired
as part of the initial transaction commit then this rejection behaves
identically to that of a rejected 'issue' event. Otherwise the
rejection will remove the prophecy from the current recital and fire
a 'purge' event at the transactor.`
    ],
    bubbles: true,
    cancelable: true,
    defaultAction: {
      setIfUndefined: {
        isRevisable: true,
      }
    },
  });
  declareName("profess", {
    tags: ["Transactor", "FabricEvent"],
    type: "EventHandler",
    description: [
`Fired at a transactor when its command has been successfully
(re-)professed into a prophecy as part of the current recital.`,
null,
`This event is fired both during the initial recital as well as during
later revision and reformation recitals.`,
null,
`If the event defaultAction is canceled or an exception is thrown then
the rejection will remove the prophecy from the current recital and
fire a 'purge' at the transactor.`,
    ],
    bubbles: true,
    cancelable: true,
  });
  declareName("record", {
    tags: ["Transactor", "FabricEvent"],
    type: "EventHandler",
    description:
`Fired at a transactor when a copy of its command has been written to a
persistent storage.`,
    bubbles: true,
    cancelable: false,
  });
  declareName("truth", {
    tags: ["Transactor", "FabricEvent"],
    type: "EventHandler",
    description:
`Fired at a transactor when its command has been authorized as truth.`,
    bubbles: true,
    cancelable: false,
  });
  declareName("schism", {
    tags: ["Transactor", "FabricEvent"],
    type: "EventHandler",
    description:
`Fired at a transactor when a prophecy that took part in a revision is
deemed to be schismatic and which thus is subsequently going to be
subject to a reformation.`,
    bubbles: true,
    cancelable: true,
    defaultAction: {
      setIfUndefined: {
        isRevisable: true,
      }
    },
  });
  declareName("purge", {
    tags: ["Transactor", "FabricEvent"],
    description:
`Fired at transactor when a prophecy has been purged from the recital
as a result of a rejected revision recital or a rejected reformation.`,
    bubbles: true,
    cancelable: false,
  });

  declareName("error", {
    tags: ["Fabricator", "Failure", "FabricEvent"],
    type: "EventHandler",
    description:
`Fired at a fabricator frame when a script, fabrication or behavior
error occurs inside the fabrication context.`,
    bubbles: true,
    cancelable: true,
    defaultAction: {
      setIfUndefined: {
        isSchismatic: true,
        isRevisable: false,
        isReformable: true,
      },
    },
  });
  declareName("precondition", {
    deprecation: "Frame Fabricator API is still unimplemented in ValOS gateway",
    tags: ["Fabricator", "FabricEvent"],
    type: "EventHandler",
    description: [
`Fired at all frame fabricators in depth-first pre-order during all
fabrications (ie. during initial fabrication and during revision and
reformation replays).`,
null,
`Calling event.preventDefault or throwing an exception will reject the
computation frame.
If the frame is rejected during the initial fabrication an exception is
(re-)thrown within the frame and can be caught by its catch-block.`,
null,
`Semantics of revision and reformation refabrications are not defined
yet.`,
    ],
    bubbles: false,
    cancelable: false,
    defaultAction: {
      call: ["validatePreConditions"],
    },
  });
  declareName("postcondition", {
    deprecation: "Frame Fabricator API is still unimplemented in ValOS gateway",
    tags: ["Fabricator", "FabricEvent"],
    type: "EventHandler",
    description: [
`Fired at all frame fabricators in depth-first post-order during all
fabrications (ie. during initial, revision and reformation fabrications).`,
null,
`Calling event.preventDefault or throwing an exception will reject the
computation frame.
If the frame is rejected during the initial fabrication an exception is
(re-)thrown within the frame and can be caught by its catch-block.`,
null,
`Semantics of revision and reformation refabrications are not defined
yet.`,
    ],
    bubbles: false,
    cancelable: false,
    defaultAction: {
      call: ["validatePostConditions"],
    },
  });
  declareName("revise", {
    deprecation: "Frame Fabricator API is still unimplemented in ValOS gateway",
    tags: ["Fabricator", "FabricEvent"],
    type: "EventHandler",
    description: [
`Fired at frame fabricators during review phase of a schismatic
prophecy, in depth-first pre-order immediately after a the
corresponding frame precondition event.`,
    ],
    bubbles: true,
    cancelable: true,
    defaultAction: {
      setAlways: {
        isSchismatic: false,
      },
    },
  });
  declareName("reform", {
    deprecation: "Frame Fabricator API is still unimplemented in ValOS gateway",
    tags: ["Fabricator", "FabricEvent"],
    type: "EventHandler",
    description:
`Fired at all frame fabricators during reform phase of a schismatic
prophecy in depth-first post-order.`,
    bubbles: true,
    cancelable: true,
    defaultAction: {
      setAlways: {
        isSchismatic: false,
      },
    },
  });
}
