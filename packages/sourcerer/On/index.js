const { em, ref } = require("@valos/revdoc/extractee");
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
    addLabel([`On:${name}={`, em("handler"), `}`],
        `On:${name}`,
        ["When used as a ", ref("Lens:Element"), " attribute"]);
    addLabel([`[$\`On:${name}\`]: `, em("handler"), `,`],
        `On:${name}`,
        ["When set as an element ", ref("Lens:context"), " attribute property"]);
    addLabel([`addEventListener("${name}", `, em("handler"), `)`],
        undefined,
        "When called on a Valoscript event target");
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
  declareName("proclaim", {
    tags: ["Transactor", "FabricEvent"],
    type: "EventHandler",
    description: [
`Fired at a transactor when its commit has been requested but before
its command has been composed as part of the canonical recital.`,
null,
`This event is fired only during the initial commit. If the transactor
recital is a direct continuation of the canonical recital then the
internal transactor recital is made into a canonical recital. Otherwise
a 'compose' event is fired at the transactor and the command will be
re-composed. In both cases the command is then professed into a
prophecy and a 'profess' event is then fired at the transactor.`,
null,
`If the handler cancels the event defaultAction or throws an exception
then the transaction is immediately rejected. The command will not be
professed and the fabric commit will throw an exception instead.`,
    ],
    bubbles: true,
    cancelable: true,
  });
  declareName("compose", {
    tags: ["Transactor", "FabricEvent"],
    type: "EventHandler",
    description: [
`Fired at a transactor when its command is about to be (re-)composed
into a prophecy that is going to be made a part of the canonical
recital.`,
null,
`This event may be fired during the initial commit if the transactor
is not a direct continuation of the canonical recital but will always
be fired during later revision, reformation and refabrication
recompositions.`,
null,
`The composition performs three main functions:`,
      { "numbered#": [
[em("Universalization"), `: splits the transactor command into
  chronicle-specific universal sub-commands`],
[em("Reduction"), `: appends the sub-commands on top of the current
  canonical recital and updates the corresponding resource state`],
[em("Validation"), `: evaluates frame pre/postconditions and the
  structural, semantic and behavior validity of the sub-commands`],
      ] },
`If the handler cancels the event defaultAction or throws an exception
then the composition of the command is rejected. If this event was
fired as part of the initial commit then this rejection behaves
identically to that of a rejected 'proclaim' event. Otherwise the
rejection removes the prophecy from the canonical recital and fires
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
`Fired at a transactor when its command prophecy is about to be
(re-)professed into a canonical prophecy as part of the canonical
recital.`,
null,
`This event is fired both during the initial recital as well as during
later revision, reformation and refabrication recitals. This event is
immediately followed by the propagation of the new canonical recital to
all downstream listeners.`,
null,
`After profess the prophecy is in-flight and out of control of the
transactor until a 'truth', 'schism' or 'purge' event is fired. "The
ball is in the authorities' court" so to speak.`,
null,
`If the handler cancels the event defaultAction or throws an exception
then the prophecy will not be (re-)professed as part of the canonical
recital. If the prophecy was already part of the canonical recital is
purged and a 'purge' event is fired at the transactor.`,
    ],
    bubbles: true,
    cancelable: true,
  });
  declareName("record", {
    tags: ["Transactor", "FabricEvent"],
    type: "EventHandler",
    description: [
`Fired at a transactor when a copy of one of its canonical prophecy
chronicle sub-commands has been written to a persistent storage.`,
null,
`After this the individual sub-command will survive an execution
environment reset and become truths after it has been restarted. This
can happen for example if the a web app was used in offline mode and
its tab was closed but which was later reopened when online.`,
null,
`Note that because the transactor itself nor any of its handlers will
not survive a refresh the handlers cannot be relied on alone to execute
semantic life cycles to completion.`,
    ],
    bubbles: true,
    cancelable: false,
  });
  declareName("truth", {
    tags: ["Transactor", "FabricEvent"],
    type: "EventHandler",
    description: [
`Fired at a transactor when its canonical prophecy has been authorized
as truth by of its chronicle sub-command authorities.`,
null,
`Note that because the transactor itself nor any of its 'truth' event
handlers will not survive an execution environment refresh the handler
itself cannot be relied on alone to execute semantic life cycles to
completion.`,
    ],
    bubbles: true,
    cancelable: false,
  });
  declareName("schism", {
    tags: ["Transactor", "FabricEvent"],
    type: "EventHandler",
    description: [
`Fired at a transactor when its currently canonical prophecy is
considered `, em("schismatic"), ` and going to undergo revisioning.`,
null,
`A prophecy becomes `, em("schismatic"), ` as a result of a `,
em("schism"), ` on the event flow of one its chronicle sub-commands
and thus subject to removal from the canonical recital.`,
null,
`The purpose of the revisioning is to determine whether the sub-command
might yet be confirmed as truth by its authority and thus should be
retained as part of the canonical recital. If not, the prophecy is
removed from the canonical recital and a 'reform' or 'purge' event will
be fired at the transactor depending on the resolution.`,
null,
`Schisms have two primary categories, each with a different reason
on why the command might be still in-flight:`,
      { "numbered#": [
[`Schisms caused by reformations and purges in the chronicle history
  might allow for a sub-command to nevertheless remain in-flight if it
  is configured to be reorderable by the upstream`],
[`Schisms caused by upstream delivery errors might allow for the
  sub-command to remain in-flight if the error is only an auxiliary
  error in the immediate upstream command delivery tracking. The actual
  command might still reach the target and be later be received and
  confirmed as a truth via the primary event downstream.`],
      ] },
null,
`Ordinarily the schism revisioning is performed internally. A handler
may inspect the schism conditions and decide to override this process
by setting `,  em("isRevisable"), ` to desired value and then canceling
the default action. Otherwise the default policy associated with the
specific schism is followed.`,
null,
`Note: The purpose of 'schism' is to avoid having to wait for upstream
roundtrips on each step of the event flow while ensuring that a command
is sent once and only once.`,
`Semantically conservative resolutions are "accept" and "purge" as they
don't result in reformation and its possibly duplicate re-delivery of
the sub-commands. Purge immediately delegates the ball back to
valospace application logic whereas accepting the prophecy as canonical
will later either be confirmed as truths or reformed by a conflicting
truths coming downstream.`,
    ],
    bubbles: true,
    cancelable: false,
    defaultAction: {
      setIfUndefined: {
        isSchismatic: true,
        isRevisable: false,
        isReformable: true,
      }
    }
  });
  declareName("reform", {
    tags: ["Transactor", "FabricEvent"],
    type: "EventHandler",
    description: [
[`Fired at a transactor when a `,  em("schismatic"), ` prophecy cannot
be revised and has been temporarily removed from the canonical recital.
The prophecy is about to be `, em("reformed"), ` ie. about to have all
of its chronicle sub-commands be recomposed and redelivered to their
upstream authorities.`],
null,
`This event can result from several different conditions:`,
      { "numbered#": [
[`A chronicle sub-command recomposition fails due to a structural or
  behavioral inconsistency between the old and the new recital history
  - authorities cannot reorder such commands.`],
[`A sub-command upstream delivery responds with an error condition with
  isReformable set to true`],
[`Others (TODO: formalize).`],
      ] },
null,
`Irrespective of cause of the reformation the transactor event handlers
can now once again make decisions on the transactor command life cycle.
"The ball is back on transactor's court".`,
null,
`If the handler cancels the event defaultAction or throws an exception
then the prophecy is excluded from the reformation and a 'purge' event
is fired at its transactor.`,
null,
`Calling `, em("reformAfterAll"), ` with one or more conditions (which
might contain promises) will delay the prophecy reformation until the
promise resolves. If after resolution one of the conditions is strictly
equal to false or if any condition throws an error the reform is
skipped. This results in a purge semantically equally to throwing the
error from the handler.`,
    ],
    bubbles: true,
    cancelable: true,
    defaultAction: {
      setAlways: {
        isSchismatic: false,
      },
    },
  });
  declareName("purge", {
    tags: ["Transactor", "FabricEvent"],
    description: [
`Fired at a transactor when its command has been permanently rejected
from the canonical recital without further reformation or refabrication
attempts.`,
null,
`This event can result from several different conditions. Typical
reasons include unrecoverable rejection by one of the prophecy
chronicle sub-command authorities or a rejection during prophecy
reformation.`,
    ],
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
`Fired at all frame fabricators in a depth-first pre-order during all
compositions (ie. during the initial fabrication, during revision and
reformation recompositions and during a full refabrication).`,
null,
`The handler of this event should inspect invariant preconditions of
the execution frame.`,
null,
`If the handler cancels the defaultAction or throws an exception the
computation frame is rejected. If this rejection happens during the
initial fabrication or during a refabrication an exception is
(re-)thrown within the frame itself.
In other cases a frame rejection is semantically equivalent to an
exception thrown by a handler of the immediately preceding 'reform'
event.`,
    ],
    bubbles: false,
    cancelable: true,
    defaultAction: {
      call: ["validatePreConditions"],
    },
  });
  declareName("postcondition", {
    deprecation: "Frame Fabricator API is still unimplemented in ValOS gateway",
    tags: ["Fabricator", "FabricEvent"],
    type: "EventHandler",
    description: [
`Fired at all frame fabricators in a depth-first post-order during all
compositions (ie. during the initial fabrication, during revision and
reformation recompositions and during a full refabrication).`,
null,
`The handler of this event should inspect invariant postconditions of
the execution frame.`,
null,
`If the handler cancels the defaultAction or throws an exception the
computation frame is rejected. If this rejection happens during the
initial fabrication or during a refabrication an exception is
(re-)thrown within the frame itself.
In other cases a frame rejection is semantically equivalent to an
exception thrown by a handler of the immediately preceding 'reform'
event.`,
    ],
    bubbles: false,
    cancelable: true,
    defaultAction: {
      call: ["validatePostConditions"],
    },
  });
  declareName("review", {
    deprecation: "Frame Fabricator API is still unimplemented in ValOS gateway",
    tags: ["Fabricator", "FabricEvent"],
    type: "EventHandler",
    description: [
`Fired at the fabricators of `, em("reformed"), ` frames in a
depth-first pre-order immediately after the corresponding frame
precondition event.`,
null,
`Reformed frames arise during reformation of a schismatic prophecy.
A frame is considered reformed if it is the innermost frame that
directly contains modifications on a set of global primary resources
whose modification history was affected by the reformation. Note that
all structured sub-resources are recursively considered to be part of
their owning global resource.`,
null,
`The modified resources are listed in the event property <TODO>.`,
null,
`If the handler cancels the defaultAction or throws an exception the
reformed frame is rejected. The rejection semantics are equivalent to
those of an exception thrown by a handler of the preceding 'reform'
event.`,
    ],
    bubbles: false,
    cancelable: true,
    defaultAction: {
      setAlways: {
        isSchismatic: false,
      },
    },
  });
}
