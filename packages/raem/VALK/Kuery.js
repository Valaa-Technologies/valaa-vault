import { vRef } from "~/raem/VRL";
import type { VRL } from "~/raem/VRL"; // eslint-disable-line no-duplicate-imports
import { expandVPath, affixVPath } from "~/raem/VPath";

import beaumpify from "~/tools/beaumpify";
import invariantify, { invariantifyArray, invariantifyNumber, invariantifyString,
    invariantifyObject } from "~/tools/invariantify";
import { dumpObject as _dumpObject, wrapError } from "~/tools/wrapError";
import trivialClone from "~/tools/trivialClone";

import { isHostRef, tryHostRef } from "./hostReference";

const dumpify = require("~/tools/dumpify").default;
const inBrowser = require("~/gateway-api/inBrowser").default;

/* TODO(iridian, 2019-02): Simplify design into the steps, ops, paths
and expressions design described below. Right now the various ops are
often not clearly one or the other, can be hybrids even. This is
problematic because the semantics is not clear from just looking at
syntax. A solution that I recently tried was to just go all-in on
one or the other (path or express) semantics and require expilcit
operations for the other variant. But neither is satisfactory: the
amount of boilerplate for simple operations is near untolerable:

`["§->", ["§$$", "foo"], ["§.", "propname"], ["§.", "bar"]` vs.
`["§->", ["§$$", "foo"], "propname", "bar"]`

on one hand or

`{ foo: ["§'", "strval"], bar: ["§'", 0] }` vs.
`{ foo: "strval", bar: 0 }`

on the other hand.

Parameterized op ids might make the former less verbose:

`["§->", ["§$$foo"], ["§.propname"], ["§.bar"]]`

but this does not save one from having to type brackets and sections
signs constantly.
And this is also fundamentally dirty. Self-referential meta-operations
which construct VAKON on-the-fly would require string-manipulation
primitives. This would be a great waste, because meta-programming is
a powerful idiom and VAKON has the opportunity make strong use of the
excellent balance between structure and simplicity that JSON provides
and skip syntactic string-manipulation completely. So parameterized
operation identifiers are no good.

Thus my latest and possibly the last design attempt before VAKON gets
out in the wild is this division into these two modes. It is based on
the observation that when traversing graphs, trees, it's more likely
that sub-steps are also traversal steps. This includes array and object
sub-steps which often aggregate kueries inside them and don't often
contain literal values.
On the other hand when passing arguments to function calls,
constructing values to bind to local variables, it's much more common
to have a lot of literal values than it is to have field accesses.

They are unfortunately syntactically recursively contextual, in that
two syntactically identical arrays/objects can have different
evaluation semantics. This is a nuisance and as such; a hint of
something being wrong. But I do think that there are two (or more)
genuinely separate underlying concepts at play here. These would
ideally would have different syntactic constructs as well just like
generic languages do.
The issue is thus more probably a symptom of the constained JSON shoe
into which VAKON is forced. But as this was a design choice to begin
with, the nuisance of contextuality might have to be tolerated and
ameliorated via other means.


# 1. A VALK *step* can be an *operation*

A VALK *step* is something that can be evaluated by a VALK execution
engine or *valker*. For given valid VAKON kuery each of its JSON values
is also a *VAKON step* with the sole [1] exception of
*operation identifier*:

> *VAKON operation identifier* (*op id*) is any string value which
appears as the first entry of a VAKON array and with its first
character equal to the section sign '§' (U+00A7).

The array surrounding an op id is then *VAKON operation*. While the op
id is not a step (it is never evaluated) the operation itself is a
step.

// TODO(iridian, 2019-02): Evaluate the '§' character. It's a giant FU
// for non-finnish keyboard users, but on the other hand it has the
// general benefit of minimizing ambiguity for human readers. And the
// specific benefit of minimizing accidental machine ambiguity which
// has value at the early stage of ValOS development.

[1]: JSON object keys are another JSON *syntactic construct* which is
are not VAKON steps. They however are not JSON values either; their
grammar is restricted to strings.

# 2. VAKON steps have either *TRAVERSE* or *EXPRESS* mode semantics.

These two modes differentiate two main semantic classes for VAKON
syntactic constructs. Especially the following behaviours are strongly affected:
- the coupling of sibling steps: dependent and coupled vs. independent and uncoupled
- the semantics of non-op steps: semantic vs. literal

> The mode is syntactic. The mode of each VAKON syntactic construct is
determined by the construct itself (for op steps) or by the innermost
enclosing VAKON op steps.

Specifically this means that syntactic array and object structures
use the mode for their entry value evaluation. They construct array and
object values regardless of mode but in express their value entry steps
are evaluated as direct literals whereas in path mode all entry steps
are evaluated as semantic operations.

## 2.1. Traverse mode

Traverse operations or *traversals* consists of control flow
operations, statement sequences, field lookups and other chained
expressions.

### 2.1.1. Contextual, linear and coupled sibling steps

The evaluation behaviour of traverse sub-steps is specified by
the traverse operation itself. Traversals (such as if-statements)
typically specify strict dependent sequencing for particular sub-steps
and require previous steps to fully complete before evaluating any
steps depending on them. Linearily chaining operations give the current
head as input for sub-steps and put the output as the head for
subsequent sub-steps.
Thus the traversal sub-steps are often conceptually highly coupled.

### 2.1.2. Semantic non-op sub-steps

Traversal non-op sub-steps are semantically evaluated. While the
semantics can be specific to the particular traversal the JSON values
have idiomatic meanings: null is an identity and resolves to head,
strings and numbers are head field/property accesses, arrays and
objects will construct arrays and objects, false/true check head for
falsy/truthy for short-circuiting and assertion purposes.

## 2.2. Express mode

Express operations or *expressions* consists of function calls
including argument evaluation, unary, binary operator calls and
other builtin operation calls.

### 2.2.1. Context-free, independent and uncoupled sibling steps

Expression sub-step evaluation behaviour is defined by VALK. The
the expression itself has no semantic access to its sub-steps, only on
their evaluated values. Express ops never update the head for any of their
sub-steps, ie. all sub-steps use the head value of the express op
itself. Expressions cannot put requirements on the order and
inter-dependency between sub-steps (unlike traversals, where
a sub-sequent step can depend on the output of the previous one).

### 2.2.2. Literal non-op sub-steps

Expression sub-steps which are not operations are evaluated as literal
values. Null is null, string is a string, arrays and objects construct
array and object values. Note that all operation sub-steps (even those
nested in arrays and objects constructs) are fully evaluated.

*/

/**
 * VALK - VAlos Language for Kuerying
 * ==================================
 *
 * VALK Kuery is a generic graph query that can be `run` starting from a value called `head`,
 * with each of the kuery `steps` advancing the head to a new value, with the kuery run returning
 * the value of the final head.
 *
 * ```
 * import V from "@valos/raem/VALK";
 * const to5thDistantCoords = V
 *     .toField("positions")
 *     .filter(V.add(V.to("x"), V.to("y")).greaterThan(10))
 *     .toIndex(5).nullable()
 *     .select(["x", "y"]);
 * ```
 *
 * The corresponding JSON for this Kuery ('VAKON' from hereon, VAlos Kuery Object Notation) is:
 * ```
 * const to5thDistantCoords = ["$->",
 *   "positions",
 *   ["$filter", ["$>", ["$+", ["x"], ["y"]], 10]],
 *   5, false,
 *   { x: "x", y: "y" },
 * ];
 * ```
 *
 * Running this path kuery results in an object with "x" and "y" fields of the fifth 'positions'
 * entry of myObject which has coordinate sum greater than 10:
 *
 * `expect(run(myObject, to5thDistantCoords)).toEqual({ x: 10, y: 20 });`
 *
 * Or alternatively, the kuery can contain the starting point as a builtin:
 *
 * `expect(run(null, V.fromValue(myObject).toKuery(to5thCoords)).toEqual({ x: 10, y: 20 });`
 *
 * If `myObject` does not have 5 positions objects (ie. the head is undefined after the toIndex(5)
 * step) the result will result in undefined due to nullable()/false short-circuiting it. Normally
 * an operation on an undefined object (here the select) throws an error.
 *
 * Design aims of VALK are to:
 * 1. be a simple, intuitive but still fully expressive and extensible graph query language
 * 2. seamlessly integrate with native javascript object and execution models
 * 3. be fully abstract: kueries are abstract objects and valking engines (see `Valker`) have full
 *   freedom to extend the semantics for their runs.
 *
 * VALK path kueries
 * -----------------
 *
 * const toSillynessAndBeyond = V.to("I").to("am").to("a").to("silly").to("path").to("kuery");
 *
 * The basic building block of VALK is the path Kuery which consists of a sequence of steps.
 * Each step represents a transition from the current head to next head, ie. the head for the next
 * step. The head reached after the last step is the result of the path Kuery.
 *
 * In the above example the 'to' convenience calls add new steps and because Kuery is an immutable
 * structure each 'to' returns the new resulting Kuery. This allows chaining, full composition and
 * reuse of any intermediate Kuery objects if desired.
 *
 * const toIAmUnchanging = V.to("firstPart");
 * const toChain = toIAmUnchanging.to("secondPart");
 *
 * Most of the Kuery convenience functions will add a new path step. This is done by either a
 * adding a new step to the existing path Kuery (returning the new, modified version of it as per
 * immutable rules) or by creating a fully new path Kuery. When creating a new Kuery the whole
 * current Kuery is set as its first step.
 *
 * VALK fields and indices
 * -----------------------
 *
 * const toFieldThenIndex = V.to("values").to(10);
 * const entryIndex = 10;
 * const toSameButDifferent = V.toField("values").toIndex(entryIndex);
 *
 * While any Kuery can be used as a step, the most typical steps are the primitive Kuery's:
 * field lookup and index steps. Valking these expect current head to be an object or an
 * indexable sequence (respectively) and valk to the indicated member or sequence entry as the next
 * head.
 *
 * VALK arrays and objects
 * -----------------------
 *
 * map, filter and find Kuery's can be used to transform sequences by having their sub-Kuery's be
 * applied to the sequence members.
 *
 * VALK expressions
 * ----------------
 *
 * const toSumOfFields = V.fromValue({ a: 1, b: 2 }).add(V.to("a"), V.to("b"));
 *
 * Complex expression Kuery's can be built, such as arithmetic and logical steps. Whenever a
 * an expression step is advanced all of its parameter sub-steps are advanced from the same, shared
 * head. This head is advanced only after the expression itself is evaluated.
 *
 * Unlike other Kuery members the expression convenience functions always return
 * an expression Kuery: They do not extend the existing Kuery with new steps. However if an unary
 * or binary expression is called with too few arguments the existing kuery will be
 * 'subsumed' as the first argument.
 *
 * Complex result sets can be built using select Kuery: all of the values of a select Kuery object
 * are sub-Kueries that get executed. Their results will be placed in object with their
 * corresponding key and this object then is the result of the select. This head is then treated
 * like any other object head and can be accessed with field primitive steps. Especially useful
 * as a head of an expression, as its sub-expressions all start their evaluation from the same head.
 *
 * headType
 * --------
 *
 * VALK Kuery objects can carry type information with them in the form of Kuery.headType(): string.
 * This type information is not translated into JSON form and is used by live Kuery systems.
 * Some steps (like Kuery.toField) allow for specifying the headType directly, but
 * Kuery.setHeadType can be used to set it for any Kuery.
 *
 * naming principles
 * -----------------
 *
 * Steps explicitly described as core steps form the core functionality of VALK. They might
 * also belong to some other categories below.
 *
 * A step prefixed with 'from' (or behaviour described as 'from-step') sets the head while ignoring
 * its current value, has no state or scope side-effects and doesn't valk any arguments. The value
 * is usually read from the scope or state; similar to providing the initial head for run, these are
 * the typical starting points of VALK paths.
 *
 * A step prefixed with 'to' (or behaviour described as a 'to-step') might use the current head to
 * advance to new head but have no direct state or scope side-effects (however their
 * possible arguments might).
 *
 * A step prefixed with 'no' (or behaviour described as a 'no-step') doesn't advance the head, has
 * no scope or graph side effects and doesn't contain sub-steps.
 *
 * A step prefixed with 'do' (or behaviour described as a 'do-step') doesn't advance the head, but
 * has direct state or scope side-effects. These are used for more complex kueries, like script
 * evaluation, scope management and abstraction piercing.
 *
 * Operations explicitly described as host steps make use of the "§<opName>" syntax to access
 * builtin steps. By default they valk all of their arguments against the head eagerly,
 * however some builtin steps explicitly perform lazy evaluation or no evaluation at all.
 *
 * Operations which are none of the above are complex steps built of simpler steps: their
 * arguments are evaluated against head like with builtins.
 *
 * @export
 * @class Kuery
 */
export default class Kuery {
  // Core steps

  /**
   * Step which depends on the type of the given step parameter.
   * If the step is a string, forwards to .toField(step).
   * If the step is a number, forwards to .toIndex(step).
   * If the step is null, forwards to .head().
   * If the step is boolean, forwards to .nullable() if step is false or .notNull() if it is true.
   * If the step is an object, forwards to .toTemplate(step): arrays and plain objects will be
   * expanded and any other values will be wrapped as literal values.
   *
   * Otherwise an exception will be thrown.
   *
   * TODO(iridian): This kitchen sink convenience function needs careful thought as the default
   * choice; There's no going back once this is out in the wild.
   * Is there any benefit in giving the simple & lazy option over encouraging strict consistency
   * checking by renaming this as 'json' and advising people to use index, field, valk etc.
   * appropriately?
   *
   * @param {any}     jsonStep
   * @param {string}  headType  The type of the head, ie. the start type of the specified jsonStep.
   * @returns {Kuery} A path kuery object containing given jsonStep as the last step.
   */
  to (step: any, headType: ?string): Kuery {
    switch (typeof step) {
      case "object": if (step) return this.toTemplate(step, headType); // eslint-disable-line no-fallthrough
      case "boolean":
      case "string":
      case "symbol": // TODO(iridian): This will not serialize and is thus quite broken.
      case "number":
        return this._addPathRawVAKON(step, headType);
      case "function":
        throw new Error(`VALK.to: invalid step, got function '${step.name}'`);
      default:
        throw new Error(`VALK.to: invalid step type '${typeof step}'`);
    }
  }

  /**
   * Core no-step.
   * Mostly useful as an expression argument, inside selections and other more complex constructs as
   * placeholder to denote that current head should be used directly without modification.
   *
   * Corresponds to VAKON identity primitive:
   *   null
   *
   * @returns {Kuery}
   */
  head (): Kuery {
    return this.isActiveKuery() ? this : this._newRawVAKON(["§->", null]);
  }

  /**
   * Core no-step unless head is null or undefined. If so, nullable valk short-circuits the on-going
   * surrounding path valk and advances its resulting head to null or undefined, respectively.
   *
   * If the surrounding valk is not a path (ie. an expression or other), nullable will abort the
   * valk of that step (including the valk of remaining arguments) and keep unwind the valk stack
   * until it finds a path or the run entry point, whichever comes first. If nullable is the last
   * explicit step of a path, that path is ignored for the purposes of unwinding.
   *
   * FIXME(iridian): Short-circuiting from expressions is not implemented yet, and nullable as last
   * step is a no-step.
   *
   * Corresponds to VAKON boolean:
   *   false
   *
   * @returns {Kuery}
   */
  nullable (): Kuery {
    return this._addPathRawVAKON(false);
  }

  /**
   * Core no-step which throws an exception if the head is null or undefined.
   * Precede with VALK.comment to add information to the exception context.
   *
   * Corresponds to VAKON boolean:
   *   true
   *
   * @returns {Kuery}
   */
  notNull (errorMessage: ?string): Kuery {
    if (!errorMessage) return this._addPathRawVAKON(true);
    return this.to(this._newRawVAKON(true).comment(errorMessage));
  }

  /**
   * Core from-step which starts the valk from given value by setting it as the new head.
   * Most of the time this is implicitly added (such as for all expression parameters) but some
   * steps require this to be explicit (map, all strictly boolean condition clauses like if,
   * filter, find, etc).
   *
   * VALK base API will use the given value verbatim as a JSON object head. Extended VALK API's
   * are expected to use 'from' as an entry point for converting convenience classes to their
   * kuery runtime VAKON extended formats.
   *
   * Basic, non-converted values correspond to VAKON literal primitive:
   *   ["§'", value]
   * Converted values correspond to VAKON extended format:
   *   [`§${schema}`, value]
   * where schema identifies the format of the value for the extension.
   *
   * @param {*} value  A JSON value to set as new head (will not be interpret as VALK).
   * @returns {Kuery}
   */
  fromValue (value: any, headType: ?string): Kuery {
    const hostRef = tryHostRef(value);
    return this._addRawVAKON(
        hostRef ? [`§vrl`, hostRef.toJSON()]
            : (value === undefined) ? this._root.void()
            : ["§'", value],
        headType);
  }

  fromVAKON (kuery: any, type: ?string): Kuery {
    return this._addRawVAKON(kuery, type);
  }

  fromVPath (vrid: string | Array<any>, type: ?string): Kuery {
    return this._addRawVAKON(affixVPath(expandVPath(vrid)), type);
  }

  /**
   * Core from-step which sets the current head to the given object.
   *
   * @param {string | VRL} object The idData describing the object to refer to.
   * @param {string} typeName The type of the object described by the given idData.
   * @returns {Kuery}
   */
  fromObject (object: string | VRL, headType: ?string) {
    const ref = tryHostRef(object) || ((typeof object === "string") ? vRef(object) : undefined);
    if (!ref && (object !== null)) {
      throw new Error(`VALK.fromObject.object is not a valid object reference, got: ${object}`);
    }
    return this.fromValue(ref, headType);
  }

  refer (target: any, headType: ?string) {
    console.error("DEPRECATED: VALK.refer\n\tprefer: VALEK.fromObject");
    return this.fromObject(target, headType);
  }

  /**
   * Core to-step which advances to the given value. If the given value is an array or a
   * naked object all directly contained sub-kueries are advanced against the original head.
   * Otherwise this step is a plain V.fromValue from-step.
   *
   * This function is applied to most expression parameters: indicated by "valueVAKON" call
   * appearing in the documentation of the function VAKON section.
   *
   * @param {*} value
   * @param null headType
   * @param {any} string
   * @returns {Kuery}
   */
  toTemplate (value: any, headType: ?string): Kuery {
    if (value instanceof Kuery) return this.toKuery(value, headType);
    if ((value === null) || (typeof value !== "object")
        || ((Object.getPrototypeOf(value) !== Object.prototype) && !Array.isArray(value))) {
      return this.fromValue(value, headType);
    }
    return this._addRawVAKON(_recurseToVAKON(value), headType);
  }

  /**
   * Core to-step which advances to the given fieldName of the current head (which must thus be
   * a keyed collection).
   *
   * Corresponds to VAKON field primitive:
   *   fieldName
   *
   * @param {string} name
   * @param {string} headType  The type of the head, ie. the owning type of the specified field.
   * @param {any} string
   * @returns {Kuery}
   */
  toField (fieldName: string | Object, headType: ?string): Kuery {
    if (typeof fieldName === "object") return this.evalk(fieldName).setHeadType(headType);
    invariantifyString(fieldName, "VALK.toField.name");
    return this._addPathRawVAKON(fieldName, headType);
  }

  field (name: string, headType: ?string): Kuery {
    console.error("DEPRECATED: VALK.field\n\tprefer: VALK.toField");
    return this.toField(name, headType);
  }

  /**
   * To-step which advances to a selection object of all given fieldNames.
   *
   * @param {string[]} names
   * @returns {Kuery}
   */
  toFields (...fieldNames: string[]): Kuery {
    invariantifyArray(fieldNames, "VALK.toFields.names", { elementInvariant: (fieldName, index) =>
      invariantifyString(fieldName, "VALK.toFields.names[index]", {}, "\n\tname index:", index)
    });
    return this.select(fieldNames);
  }

  fields (...fieldNames: string[]): Kuery {
    console.error("DEPRECATED: VALK.fields\n\tprefer: VALK.toFields");
    return this.toFields(...fieldNames);
  }

  /**
   * Core to-step which advances to the entry at the given index of the current head (which thus
   * must be an indexable collection).
   *
   * Corresponds to VAKON index primitive:
   *   index
   *
   * Introduces { __index__: index } to scope, \see fromIndexValue.
   *
   * @param {number} index
   * @returns {Kuery}
   */
  toIndex (index: number, headType: ?string): Kuery {
    if (typeof index === "object") return this.evalk(index).setHeadType(headType);
    invariantifyNumber(index, "VALK.toIndex.index", { integer: true });
    return this._addPathRawVAKON(index, headType);
  }

  /**
   * from-step which sets the most previous index value as the new head.
   *
   * @returns {Kuery}
   *
   * @memberof Kuery
   */
  fromIndexValue (): Kuery { return this.fromScope("__index__"); }

  index (index: number): Kuery {
    console.error("DEPRECATED: VALK.index\n\tprefer: VALK.toIndex");
    return this.toIndex(index);
  }

  /**
   * to-step which advances with the given kuery from the current head.
   *
   * Corresponds to VAKON:
   *   path.toVAKON()
   *
   * @param {Kuery} value
   * @returns {Kuery}
   */
  toKuery (path: Kuery, headType: ?string): Kuery {
    return this.isActiveKuery() || headType ? this._addStep(path, headType) : path;
  }

  /**
   * Core path-step which extracts all entries of the head as separate sub-valk heads, advances each
   * sub-head with the given toSteps and advances to a new array of the results as entries.
   *
   * Corresponds to VAKON map primitive:
   *   ["§map", ...toSteps.map(toStep => V.to(toStep).toVAKON())]
   *
   * Sets { __index__: index } to scope for each entry, \see fromIndexValue.
   *
   * @param {Kuery} toStep
   * @returns {Kuery}
   */
  map (...pathSteps: any[]): Kuery {
    return this._addStep(pathSteps.reduce(
        (acc, toStep) => acc.to(toStep), this._root._newPath("§map", [])));
  }

  /**
   * Core to-step similar to map, but instead removes the entries from the result for which toTest
   * advances to falsy, leaving the entries otherwise unchanged.
   *
   * Corresponds to VAKON map primitive:
   *   ["§filter", ...toTests.map(toTest => V.to(toTest).toVAKON())]
   *
   * Sets { __index__: index } to scope for each entry, \see fromIndexValue.
   *
   * @param {Kuery} toStep
   * @returns {Kuery}
   */
  filter (...testPathSteps: any[]): Kuery {
    return this._addPath("§filter", testPathSteps.map(toStep => this._root.to(toStep)));
  }

  /**
   * Core to-step which advances to a newly created, plain object with keys and values based on the
   * given selection object.
   * If the selection is a plain object then each value is treated as a to-step from the current
   * head, with their valks set to the corresponding keys in the result object like so:
   *
   * `for (const [key, value] of Object.entries(selection)) {
   *   newHead[key] = valk(currentHead, V.to(value));`
   * }`
   *
   * If the selection is an array of strings, the step is a trivial field selection:
   *
   * for (const key of selection) newHead[key] = valk(currentHead, V.toField(key))
   *
   * The difference between V.select(selectionObject) and V.toTemplate(object) thus is that
   * select introduces the implicit V.to to all of the selection mapping values whereas
   * V.value treats all mapping values as literals unless they're explicit Kuery objects, giving
   * us two Kuery equalities:
   *
   * V.select({ a: "a" })              <=> V.toTemplate({ a: V.toField("a") })
   * V.select({ a: V.fromValue("a") }) <=> V.toTemplate({ a: "a" })
   *
   * Both traverse and expand all sub-kueries in their selectionObject/object arguments when
   * valked.
   *
   * Note: the evaluation order of the selection sub-steps is non-deterministic. Avoid scope and
   * state side-effects in selections as a rule of thumb.
   *
   * TODO(iridian): So, the non-deterministic key iteration order of plain javascript objects is an
   * evaluation order issue here. On one hand, non-deterministic evaluation is annoying. On
   * the other hand, non-deterministic evaluation order means that select can be the fundamental
   * building block of parallelized/distributed kuery valks. Finally, because the keys are static
   * the determinism can be left to be an implementation detail of particular valkers, which can
   * for instance dictate a deterministic evaluation order for the keys.
   *
   * Corresponds to VAKON selection:
   *  {
   *     "key1": toVAKON(value1),
   *     "key2": toVAKON(value2),
   *     ...
   *  }
   * @param {any} fieldNames
   * @returns {Kuery}
   */
  select (selectors: (string[] | Object)): Kuery {
    // TODO(iridian): Add stricter invariant checks with element invariants for arrays and objects.
    invariantifyObject(selectors, "VALK.select.selectors", { allowEmpty: true });
    const selectorVAKON = {};
    if (!Array.isArray(selectors)) {
      for (const key of Object.keys(selectors)) {
        selectorVAKON[key] = this._root.to(selectors[key]).toVAKON();
      }
    } else {
      for (const rule of selectors) {
        if (!Array.isArray(rule)) selectorVAKON[rule] = rule;
        else {
          selectorVAKON[rule[0]] =
              rule.slice(1).reduce((kuery, step) => kuery.to(step), this._root).toVAKON();
        }
      }
    }
    return this._addRawVAKON(selectorVAKON);
  }

  // Valker reference engine host steps

  /**
   * Host from-step which sets the given variableName from scope as new head. If no variableName is
   * given the full scope is set as new head instead.
   *
   * Corresponds to VAKON select-head-from-scope:
   *   ["§$", variableName] | ["§$"]
   *
   * @returns {Kuery}
   */
  fromScope (variableName: any): Kuery {
    return this._addExpression("§$",
        typeof variableName === "undefined" ? [] : [variableName]);
  }

  scope (variableName: ?string = null): Kuery {
    console.error("DEPRECATED: VALK.scope\n\tprefer: VALK.fromScope");
    return this.fromScope(variableName);
  }

  /**
   * Host do-step which valks the given setters and stores the results in scope. Each setter can
   * either be a selection object or a [key, value] pair. The key/value pairs allow for computed
   * keys, with both key and value evaluated with valueVAKON as well as guaranteed deterministic
   * evaluation if any sub-steps have side-effects.
   *
   * @param {Object} selection
   * @returns {Kuery}
   */
  setScopeValues (...setters: Object): Kuery {
    invariantifyArray(setters, "VALK.setScopeValues.setters", {
      elementInvariant: (setter, index) => {
        if (!Array.isArray(setter)) {
          invariantifyObject(setter, `VALK.setScopeValues.setters[${index}]`);
        } else {
          invariantifyArray(setter, `VALK.setScopeValues.setters[${index}]`, { length: 2, },
              "\n\tcase index:", index);
        }
        return true;
      }
    });
    return this._addExpression("§$<-", setters);
  }

  /**
   * Host do-no-step which assigns the setter fields in the selection to the corresponding fields in
   * the head. Each setter can either be a selection object
   * or a [key, value] pair. The key/value pairs allow for computed keys, with both key and value
   * evaluated with valueVAKON as well as guaranteed deterministic evaluation if any sub-steps
   * have side-effects
   *
   * @returns {Kuery}
   */
  setHeadProperties (...setters: Object): Kuery {
    invariantifyArray(setters, "VALK.setHeadProperties.setters", {
      elementInvariant: (setter, index) => {
        if (!Array.isArray(setter)) {
          invariantifyObject(setter, `VALK.setHeadProperties.setters[${index}]`);
        } else {
          invariantifyArray(setter, `VALK.setHeadProperties.setters[${index}]`, { length: 2, },
              "\n\tcase index:", index);
        }
        return true;
      }
    });
    return this._addExpression("§.<-", setters);
  }

  /**
   * Host to-step which advances to a new array made of the given list of entries, each advanced
   * from the current head like with V.toTemplate([...entries]).
   *
   * const pathToArrayWith1and2 = V.array(1, 2);
   *
   * If no parameters are given 'array' converts head into an array with the head as the only entry.
   * Specifically if the current kuery is active, 'array' will subsume (\see unary) it as the only
   * entry of the array, like so:
   * FIXME(iridian): How about no. The subsumption while nifty, is quite surprising and here
   * silly to boot: there's no way to create an empty array using Kuery convenience operations.
   * Should remove this behaviour.
   *
   * const pathToArrayWith3 = V.fromValue(3).array();
   *
   * TODO(iridian): Figure out if the entry expansion for array should be with V.to, like with
   * select, for consistency.
   *
   * If the current kuery is not active, 'array' will become a step which when valked converts the
   * the current head into an array containing it, like so:
   *
   * const pathToArrayWith4 = V.fromValue(4).to(V.array());
   *
   * @param {*} [firstEntry=this.head()]
   * @param {...} entries
   * @param {any} [any=[]]
   * @returns
   */
  array (...entries: ?any[]) {
    return (entries.length || !this.isActiveKuery())
        ? this._addRawVAKON(_recurseToVAKON(entries))
        : this._root._addExpression("§[]", [this.head()]);
  }

  object (...setters) {
    return (setters.length === 1) && !Array.isArray(setters[0])
        ? this.toTemplate(setters[0])
        : this._addExpression("§{}", setters);
  }

  // Valker reference engine flow control host steps

  /**
   * Host to-step which branches the valk based on the valk of the given condition step. If the
   * condition valks to truthy, then the if-valk advances based on thenValueStep, otherwise based on
   * the elseValueStep. All valks start from the original head.
   *
   * The default thenValueStep is V.head() (ie. a no-step), the default elseValueStep is
   * V.void() (ie. from-step of undefined).
   *
   * Corresponds to VAKON expression:
   *   ["§?", toVAKON(condition), valueVAKON(thenValueStep), valueVAKON(elseValueStep)]
   *
   * Sets { __condition__: toVAKON(condition) } in scope, \see fromConditionValue.
   *
   * "§?" has special behaviour if toCondition is a literal 'false' or 'true' (as per V.value)
   * used for checking whether head is 'undefined'. In this case:
   * If (toCondition is a literal true) === (head is not 'undefined'), take thenValueStep, otherwise
   * elseValueStep.
   *
   * @param {Kuery} condition
   * @param {{ then: any, else?: ?any }} [{ then: thenValueStep, else: elseValueStep }={}]
   * @returns {Kuery}
   */
  if (toCondition: Kuery, { then: thenValueStep, else: elseValueStep }: { then: any, else?: ?any }
      = {}): Kuery {
    return this._addExpression("§?", [
      this._root.to(toCondition),
      typeof thenValueStep !== "undefined" ? thenValueStep : this._newRawVAKON(null),
      ...(typeof elseValueStep !== "undefined" ? [elseValueStep] : [])
    ]);
  }

  /**
   * from-step which sets the most previous condition value as new head.
   *
   * @returns {Kuery}
   *
   * @memberof Kuery
   */
  fromConditionValue (): Kuery { return this._root.fromScope("__condition__"); }

  /**
   * Host to-step which advances to the given `clauses.then` if head is defined, otherwise advances
   * to `clauses.else`. If `clauses.then` is not specified it will be treated as the 'null' no-step.
   *
   * @param {*} clauses
   * @returns
   */
  ifDefined (clauses: { then: any, else: any }) {
    return this.if(this._root.fromValue(true), clauses);
  }

  /**
   * Host to-step which advances to given `clauses.then` if head is undefined, otherwise advances
   * to the given `clauses.else`. If `clauses.then` is not specified it will be treated as 'null'
   * no-step.
   *
   * @param {*} clauses
   * @returns
   */
  ifUndefined (clauses: { then: any, else: any }) {
    return this.if(this._root.fromValue(false), clauses);
  }

  /**
   * Host to-step which advances from a falsy head with given thenValueStep, otherwise a no-step.
   * Syntactic sugar for V.if(null, { else: thenValueStep })
   *
   * @param {*} thenValueStep
   * @returns
   */
  ifFalsy (thenValueStep: any) {
    return this.if(this._root.fromValue(null), { else: thenValueStep });
  }


  /**
   * Host to-step which advances to the first clause value step in the given clauses for which the
   * valked clause toCondition resolves to truthy. All the toCondition and value steps are valked
   * from current head. If none of the clause toConditions valk to truthy the conditional step
   * advances to defaultClause.
   *
   * Corresponds to VAKON expression:
   *   ["§?", toVAKON([cases[0][0]), valueVAKON(cases[0][1]),
   *     ["§?", toVAKON([cases[1][0]), valueVAKON(cases[1][1]),
   *       ...
   *         valueVAKON(default)
   *       ...
   *     ]
   *   ]
   *
   * @param {[any, any][]} clauses   list of [keyOperation, valueOperation]-pairs
   * @param {{ default: any }} [{ default: defaultClause }={ default: false }]
   * @returns
   */
  conditional (cases: [Kuery, any][],
      { default: defaultClause }: { default: any } = { default: undefined }): Kuery {
    invariantifyArray(cases, "VALK.conditional.cases", {
      elementInvariant: (_case, index) => {
        invariantifyArray(_case, "VALK.conditional.cases[]", { length: 2 },
            "\n\tcase index:", index);
        invariantifyObject(_case[0], "VALK.conditional.cases[].condition", { instanceof: Kuery },
            "\n\tcase index:", index);
        return true;
      }
    });
    return this._addStep(cases.reduceRight((searchRest, [condition, value]) =>
            this._root.if(condition, { then: value, else: searchRest }),
        defaultClause));
  }

  /**
   * Host to-step which advances to the first case value step in the given cases for which
   * the valked case toCondition is V.equalTo the value of the given valked toDiscriminant.
   * The valked discriminant is also set in the scope as a side-effect and can be accessed with
   * V.fromDiscriminantValue.
   *
   * Corresponds to VAKON steps:
   *   ["§$<-", "__discriminant__", path.toVAKON()],
   *   ["§?", ["§===", ["§$", "__discriminant__"], valueVAKON(cases[0][0])],
   *       valueVAKON(cases[0][1]),
   *     ["§?", ["§===", ["§$", "__discriminant__"], valueVAKON(cases[1][0])],
   *         valueVAKON(cases[1][1]),
   *       ...
   *           valueVAKON(default)
   *       ...
   *     ]
   *   ]
   *
   * Sets [__discriminant__, V.to(discriminant)] in scope, \see fromDiscriminantValue.
   *
   * @param {*} variable
   * @param {[string, any][]} clauses
   * @param {{ default: any }} [{ default: defaultClause }={ default: undefined }]
   * @returns {Kuery}
   */
  switch (toDiscriminant: Kuery, cases: [any, any][],
      { default: defaultClause }: { default: any } = { default: undefined }): Kuery {
    invariantifyArray(cases, "VALK.switch.cases", {
      elementInvariant: (case_, index) => {
        invariantifyArray(case_, "VALK.switch.cases[]", { length: 2 },
            "\n\tcase index:", index);
      }
    }, cases);
    return this.setScopeValues({ __discriminant__: toDiscriminant })
        ._addStep(cases.reduceRight((searchRest, [name, value]) =>
                this.if(this.fromDiscriminantValue().equalTo(name),
                    { then: value, else: searchRest }),
            defaultClause));
  }


  /**
   * Host from-step which sets the most previous discriminant value as the new head.
   *
   * @returns {Kuery}
   *
   * @memberof Kuery
   */
  fromDiscriminantValue (): Kuery { return this._root.fromScope("__discriminant__"); }

  /**
   * Host no-step which adds in-line comments to be delivered with query but does not affect head.
   * These comments will appear in debug context logs if the subsumed head fails.
   *
   * @param {string} comment
   * @returns {Kuery}
   */
  comment (comment: Kuery): Kuery {
    return this.binary("§//", comment);
  }

  /**
   * Host to-step which advances with the given toExpression, setting the internal debug message
   * level to the valked given level.
   *
   * @param {string} comment
   * @returns {Kuery}
   */
  debug (level: Kuery, toExpression: Kuery): Kuery {
    return this._addExpression("§debug", [level, toExpression]);
  }

  // Sequence steps

  /**
   * To-step which advances to the first entry in current head (which must be a sequence) for which
   * a toCondition valks to a truthy value.
   *
   * Corresponds to VAKON steps:
   *   [..., ["§filter", toVAKON(condition)], 0, ...]
   *
   * This uses the implicit undefined-elimination of VALK map steps.
   *
   * @param {Kuery} condition step, evaluate head to true if valid item is found
   * @returns {Kuery}
   */
  find (toCondition: Kuery): Kuery {
    invariantifyObject(toCondition, "find.condition", { instanceof: Kuery });
    return this.filter(toCondition).toIndex(0);
  }

  // Meta-evaluation steps

  /**
   * TODO(iridian): Was there some point to this that V.array can't cover? I'm no longer seeing it.
   *
   * to-step which creates a VAKON expression with given operatorName and given args for it and
   * sets it as the new head.
   *
   * @param {*} operator
   * @param {...any} args
   * @returns
   *
   * @memberof Kuery
   */
  expression (operatorName: any, ...args: any) {
    if (operatorName === "§'") {
      return this._addExpression("§literal", [args[0]]);
    }
    return this._addExpression("§expression", [operatorName, ...args]);
  }

  /**
   * To-step which initially no-step valks the given toIntermediateVAKON into an intermediate VAKON
   * value. Evalk then advances the current head with the intermediate VAKON.
   *
   * The following two VAKONs are thus equivalent when valked:
   * ["§->", "foo", ["§map", "bar"]] <-> ["§evalk", ["§[]", "§->", "foo", ["§[]", "§map", "bar"]]]
   *
   * Note how the second ["§map", "bar"] must also be wrapped inside §[]: otherwise the mapping
   * would be valked against the head already on the initial §evalk phase; the final advance using
   * that result would likely result in an error.
   *
   * Likewise, their corresponding kueries are equivalent when valked:
   * V.to("foo").map(V.to("bar")) <-> V.evalk(V.array("§->", "foo", V.array("§map", "bar")))
   *
   * Note how this time the evalk version looks structurally more different from the original: the
   * intermediate VAKON must be manually constructed. This is expected as the intermediate step is
   * conceptually runtime kuery generation and thus the fundamentally static Kuery convenience
   * facilities cannot be used there.
   *
   * Like with the eponymous 'eval' the value doesn't come from the degenerated, simplistic examples
   * above but from the ability to store and transfer kueries themselves and then use the initial
   * evalk phase to fetch them before evaluation.
   *
   * @param {*} toIntermediateVAKON
   */
  evalk (toIntermediateVAKON: any) {
    return this._addExpression("§evalk", [this._root.to(toIntermediateVAKON)]);
  }

  /**
   * to-step which initially no-step valks the given toProgramVAKON into a program VAKON and the
   * given toCapture into a capture, wraps program and the capture inside a native function `caller`
   * and then advances the current head to this function. Thereafter whenever the `caller` is
   * called, the program VAKON is valked using the 'this' of the call as head and the capture as
   * scope.
   *
   * If toCapture is omitted the capture is the native valk scope of the initial valk.
   *
   * If the caller is called through V.apply then 'getValker' below will resolve to the calling
   * Valker otherwise getValker will resolve to a pure, stateless Valker.
   *
   * function createCaller (head, asVAKON, capturedScope) {
   *   return function caller (...args) {
   *     var callScope = Object.create(capturedScope);
   *     callScope.arguments = args;
   *     return getValker(this).advance(this, asVAKON, callScope);
   *   }
   * }
   *
   * @param {*} evaluatee
   * @returns
   *
   * @memberof Kuery
   */
  capture (toIntermediateVAKON: any, toForwardSteppersStepName: ?any, toScope: ?any) {
    return this._addExpression("§capture", [
      this._root.to(toIntermediateVAKON),
      ...(toForwardSteppersStepName !== undefined ? [this._root.to(toForwardSteppersStepName)]
          : toScope !== undefined ? [this._root.void()]
          : []),
      ...(toScope !== undefined ? [this._root.to(toScope)] : [])
    ]);
  }

  /**
   * To-step which no-step valks toCallable into a native callable and then calls it with valked
   * given toThis as the 'this' of the call and the valked given toArguments as its arguments. It
   * the advances the head to the return value of the call;
   *
   * Difference to 'call' is that apply toArguments is a single step which should valk into
   * an array. The entries of this array are then spread to be the actual invokation arguments. This
   * means that the actual number of arguments is determined dynamically right before the actual
   * native call.
   *
   * Corresponds to VAKON:
   *   ["§apply", toVAKON(callee), toVAKON(toThis), toVAKON(argumentList)]
   *
   * @param {any} params
   * @returns
   */
  apply (toCallable: any, toThis: ?any, toArguments: ?any): Kuery {
    return this._addExpression("§apply", [
      this._root.to(toCallable),
      ...(typeof toThis !== "undefined" ? [this._root.to(toThis)]
          : typeof toArguments !== "undefined" ? [this._root.void()]
          : []),
      ...(typeof toArguments !== "undefined" ? [this._root.to(toArguments)] : [])
    ]);
  }

  /**
   * To-step which (like apply) invokes given valked toCallable with given valked toThis as 'this'
   * of the call. Unlike apply, the given argsToSteps are separately valked and their results are
   * passed as the arguments of the call; this means that the number of arguments is fixed and known
   * in advance when the §call step itself is created.
   *
   * @param {any} callable      Path to the callable
   * @param {any} toThis        Path to the value which is set as this of the call
   * @param {any} args          Path to a list of arguments given to the callable
   * @returns
   */
  call (toCallable: ?any, toThis: ?any, ...args: any[]) {
    return this._addExpression("§call", [
      this._root.to(toCallable),
      ...(typeof toThis !== "undefined" ? [this._root.to(toThis)]
          : args.length ? [this._root.void()]
          : []),
      ...args,
    ]);
  }

  /**
   * To-step which valks toType into a native constructor callable, invokes it with the native new
   * operation and the valked args and finally advances to this newly created object.
   *
   * Corresponds to VAKON new operator:
   *   ["§new", typeKuery, ...args.map(valueVAKON)],
   * @param {Object} statement
   * @returns {Kuery}
   */
  new (toType: any, ...args: any[]) {
    return this._addExpression("§new", [this._root.to(toType), ...args]);
  }

  /**
   * To-step which advances to a regexp literal constructed with the valked given pattern and flags.
   *
   * Corresponds to VAKON regexp operator:
   *   ["§regexp", valueVAKON(pattern), valueVAKON(flags)]
   * @param {Object} statement
   * @returns {Kuery}
   */
  regexp (pattern: any, flags: any) {
    return this._addExpression("§regexp", [pattern, flags]);
  }

  /**
   * To-step which applies the given unary operator to head.
   *
   * If the kuery this is applied to is active, ie. the unary call is _not_ called on a VALK root
   * object but there is something between VALK and unary, like
   *   V.to("values").find(V.notEqual(0)).unary("§~")
   * unary will /subsume/ everything between the path between the most recent VALK root and itself
   * as its operand.
   * Above kuery is thus equal to the (here more readable) form:
   *   V.unary("§~", V.to("values").filter(V.notEqual(0))).
   * If subsumption happens the operand must be undefined.
   *
   * If unary has no operand and is not called on an active kuery it becomes a functor step
   * by using V.head() as its operand. Following reverses all values in a sequence:
   *   V.to("values").map(V.unary("§-"))
   *
   * Corresponds to VAKON:
   *   [{ operator: [valueVAKON(operand)] }]
   *
   * @param {string} operator
   * @returns {Kuery}
   */
  unary (operator: string, operand: ?any): Kuery {
    invariantifyString(operator, "unary.operator");
    invariantify(!this.isActiveKuery() || (typeof operand === "undefined"),
        `Cannot subsume active kuery with unary operator '${operator
        }' because it has an explicit operand`, operand, `, active kuery was`, this);
    return this._newExpression(operator,
        (this.isActiveKuery() || (typeof operand === "undefined"))
            ? [this]
            : [operand]);
  }

  /**
   * To-step which applies the given binary operator to head and given operand.
   *
   * If the kuery this is called on is active, ie. the binary call is _not_ called on a VALK root
   * object but there is something between VALK and unary, like
   *   V.to("values").find(V.notEqual(0)).binary("§-", 10)
   * binary will /subsume/ everything between the most recent VALK root and itself as its first
   * operand, pushing the given left hand side operand as the right hand side operand.
   * Above kuery is thus equal to the (this time a bit less readable) form:
   *   V.binary("§-", V.to("values").filter(V.notEqual(0)), 10).
   * If this subsumption happens the right hand side operand must be undefined.
   *
   * If binary has no right hand side and is not called on an active kuery it becomes a functor
   * step by using V.head() as its left hand side operand and pushing the given left hand
   * side to right hand side. Following subtracts 10 from all values in a sequence:
   *   V.to("values").map(V.subtract(10))
   *
   * Corresponds to VAKON:
   *   [{ operator: [valueVAKON(left), valueVAKON(right)] }]
   *
   * @param {string} operator
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  binary (operator: string, left: any, right: ?any): Kuery {
    invariantifyString(operator, "binary.operator");
    invariantify(typeof left !== "undefined", `binary.left must be specified for step ${operator}`);
    invariantify(!this.isActiveKuery() || (typeof right === "undefined"),
        `Cannot subsume active kuery with binary operator '${operator
        }' because it has an explicit right hand side operand`, right, `, active kuery was`, this);
    return this._newExpression(operator,
        (this.isActiveKuery() || (typeof right === "undefined"))
            ? [this, left]
            : [left, right]);
  }

  /**
   * Step which chains binary operands for a single operator: accepts any number of arguments which
   * are supplied to the operator call.
   *
   * chainBinary will always subsume any active kuery as its first argument and thus will NOT use it
   * as the head for sub-kuery valking. Use previous.to(V.add(...)) to avoid subsumption.
   *
   * If and only if valked from inactive kuery with only one operand it will become a functor.
   * Functor is a kuery which when valked will first valk the given operand against current head and
   * then valk the operator itself with current head as first and the valked operand as second
   * argument. So if you wanted to multiple the current head with its sign:
   *
   * valk(null, V.fromValue(-10).to(V.multiply(V.unary(".Math.sign")))); // Valks to 10.
   *
   * Note that following non-functor form would give a different result:
   *
   * valk(100, V.fromValue(-10).multiply(V.unary(".Math.sign")) // Valks to -10.
   *
   * This is because the active kuery multiply subsumes the V.fromValue(-10) kuery like so:
   *
   * valk(100, V.multiply(-10, V.unary(".Math.sign"))) // Math.sign is valked against 100.
   *
   * If you want to explicitly construct a functor with several operands, use V.head() as the
   * first argument: this is actually exactly the semantics of the single-operand functors as well.
   * Following multiplies every item by 10 and their sign:
   *   V.to("values").map(V.multiply(V.head(), 10, V.unary(".Math.sign")))
   *
   * Corresponds to VAKON:
   *   If functor: [{ operator: [null, valueVAKON(left), ...operands.map(valueVAKON)] }]
   *   Otherwise:  [{ operator: [valueVAKON(left), ...operands.map(valueVAKON)] }]
   *
   * @param {string} operator
   * @param {*} left
   * @param {any[]} operands
   * @returns {Kuery}
   */
  chainBinary (operator: string, left: any, operands: any[]): Kuery {
    invariantifyString(operator, "chainBinary.operator");
    invariantify(typeof left !== "undefined", "chainBinary.left must be specified for step:",
        operator);
    return this._newExpression(operator,
        (this.isActiveKuery() || !operands.length)
            ? [this.head(), left, ...operands]
            : [left, ...operands]);
  }

  /**
   * From-step which sets undefined as the new head after evaluating the argument.
   * Sugar for unary("§void", argument). See unary
   *
   * @returns {Kuery}
   */
  void (toArgument: ?any): Kuery {
    return this._addExpression("§void",
        typeof toArgument === "undefined" ? [] : [this._root.to(toArgument)]);
  }

  /**
   * No-step which throws given error as an exception.
   * Sugar for unary("§throw", operand). See unary
   *
   * @returns {Kuery}
   */
  throw (error: ?any): Kuery {
    return this.unary("§throw", error);
  }

  // Introspection operators

  /**
   * To-step which advances to true if the valked left side property name can be found
   * in the valked right side container, false otherwise.
   * Sugar for binary("§in", propOrObject, object). See binary
   *
   * @returns {Kuery}
   */
  in (propNameOrObject: any, object: ?any): Kuery {
    return this.binary("§in", propNameOrObject, object);
  }

  /**
   * To-step which advances to the type string of the valked operand.
   * The type string is defined as per valoscript semantics which extends the ecma-262 spec as
   * follows:
   * Operand type                                  Result
   * ValOS Resource reference                      "Resource"
   * ValOS Data reference or expanded Data object  "Data"
   * ValOS Bvob reference                          "Blob"
   * Other                                         as per ecma-262
   *
   * Sugar for unary("§typeof", operand). See unary
   *
   * @returns {Kuery}
   */
  typeof (maybeOperand: ?any): Kuery {
    return this.unary("§typeof", maybeOperand);
  }

  /**
   * To-step which advances to true if the valked given object typeof is equal to the valked given
   * typeName, false otherwise.
   *
   * Sugar for binary("§typeof", objectOrType, type). See binary
   *
   * @returns {Kuery}
   */
  typeofEqualTo (objectOrType: any, typeName: ?any): Kuery {
    return this.binary("§typeof", objectOrType, typeName);
  }

  /**
   * To-step which advances to true if the valked given object is an instance of the valked given
   * type (for example if the object was created with V.new using type), false otherwise.
   * Sugar for binary("§instanceof", operand). See binary
   *
   * @returns {Kuery}
   */
  instanceof (objectOrType: any, type: ?any): Kuery {
    return this.binary("§instanceof", objectOrType, type);
  }

  /**
   * To-step which advances to the coupled field name of the current head reference.
   * Note: this is a bit dirty and exposes the internal workings of the core valker: implementing
   * this step requires that the valker maintains how the current head was arrived at (which it
   * does).
   * Sugar for unary("§coupling", operand). See binary
   *
   * @returns {Kuery}
   */
  coupling (): Kuery {
    return this.unary("§coupling");
  }

  /**
   * To-step which advances to true if the head is a host Resource, false otherwise.
   *
   * @returns {Kuery}
   *
   * @memberof Kuery
   */
  isResource (): Kuery {
    return this.typeofEqualTo(this._root.head(), "Resource");
  }

  /**
   * To-step which advances to true if the head is a ghost, false otherwise.
   *
   * @returns {Kuery}
   *
   * @memberof Kuery
   */
  isGhost (): Kuery {
    return this.unary("§isghost");
  }

  /**
   * To-step which advances to true if the head is an immaterial ghost, false otherwise.
   *
   * @returns {Kuery}
   *
   * @memberof Kuery
   */
  isImmaterial (): Kuery {
    return this.unary("§isimmaterial");
  }

  // Logical operators

  /**
   * To-step which advances to logical negation of the current head.
   * Sugar for unary("§!", operand). See unary
   *
   * @returns {Kuery}
   */
  not (operand: ?any): Kuery {
    return this.unary("§!", operand);
  }

  /**
   * To-step which advances to true if operand valks to falsy, false otherwise.
   * Sugar for not(operand).
   *
   * @returns {Kuery}
   */
  isFalsy (operand: ?any): Kuery {
    return this.not(operand);
  }

  /**
   * To-step which advances to true if operand valks to truthy, false otherwise.
   * Sugar for unary("§!!", operand).
   *
   * @returns {Kuery}
   */
  isTruthy (operand: ?any): Kuery {
    return this.unary("§!!", operand);
  }

  /**
   * To-step which advances with first the step which valks into falsy, otherwise advances with the
   * last step. If one of the steps valks into falsy the remaining shortCircuitingSteps not valked
   * at all.
   * Sugar for reduced binary("§&&"). See binary
   *
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  and (firstStep: any, ...shortCircuitingSteps: any[]): Kuery {
    return this.chainBinary("§&&", firstStep, shortCircuitingSteps);
  }

  /**
   * To-step which advances with the first step which valks into truthy, otherwise advances the the
   * last step, If one of the steps valks into a truthy the remaining shortCircuitingSteps are not
   * valked at all.
   * Sugar for reduced binary("§||"). See binary
   *
   * @param {primitive || Kuery} operands
   * @returns {Kuery}
   */
  or (firstStep: any, ...shortCircuitingSteps: any[]): Kuery {
    return this.chainBinary("§||", firstStep, shortCircuitingSteps);
  }

  // Comparison operators

  /**
   * Sugar for binary("§===", operand). See binary
   * Comparisons which access manipulate VRL's directly must use \see looseEqualTo.
   *
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  equalTo (left: any, right: ?any): Kuery { return this.binary("§===", left, right); }

  /**
   * Sugar for binary("§!==", operand). See binary
   * Comparisons which access VRL's directly must use \see looseNotEqualTo.
   *
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  notEqualTo (left: any, right: ?any): Kuery { return this.binary("§!==", left, right); }

  /**
   * Sugar for binary("§==", operand). VRL comparisons must use this. See binary
   *
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  looseEqualTo (left: any, right: ?any): Kuery { return this.binary("§==", left, right); }

  /**
   * Sugar for binary("§!=", operand). VRL comparisons must use this. See binary
   *
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  looseNotEqualTo (left: any, right: ?any): Kuery { return this.binary("§!=", left, right); }

  /**
   * Sugar for binary("§<", operand). See binary
   *
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  lessThan (left: any, right: ?any): Kuery { return this.binary("§<", left, right); }

  /**
   * Sugar for binary("§<=", operand). See binary
   *
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  lessOrEqualTo (left: any, right: ?any): Kuery { return this.binary("§<=", left, right); }

  /**
   * Sugar for binary("§>", operand). See binary
   *
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  greaterThan (left: any, right: ?any): Kuery { return this.binary("§>", left, right); }

  /**
   * Sugar for binary("§>=", operand). See binary
   *
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  greaterOrEqualTo (left: any, right: ?any): Kuery { return this.binary("§>=", left, right); }

  // Arithmetic operators

  /**
   * To-step which advances to the arithmetic sum of the valked terms.
   * Sugar for reduced binary("§+", term). See binary
   *
   * @param {primitive || Kuery} operands
   * @returns {Kuery}
   */
  add (firstTerm: any, ...terms: any[]): Kuery { return this.chainBinary("§+", firstTerm, terms); }

  /**
   * To-step which advances to the valked given left subtracted with valked given right.
   * Sugar for binary("§-", operand). See binary
   *
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  subtract (left: any, right: ?any): Kuery { return this.binary("§-", left, right); }

  /**
   * To-step which advances to the valked given factors.
   * Sugar for reduced binary("§*", factor). See binary
   *
   * @param {primitive || Kuery} operands
   * @returns {Kuery}
   */
  multiply (firstFactor: any, ...factors: any[]): Kuery {
    return this.chainBinary("§*", firstFactor, factors);
  }

  /**
   * To-step which advances to valked given divident divided by the valked given divisor.
   * Sugar for binary("§/", divisor). See binary
   *
   * @param {primitive || Kuery} divisor
   * @returns {Kuery}
   */
  divide (dividend: any, divisor: ?any): Kuery { return this.binary("§/", dividend, divisor); }

  /**
   * To-step which advances to the remainder of the valked given divident divided by the valked
   * given divisor.
   * Sugar for binary("§%", divisor). See binary
   *
   * @param {primitive || Kuery} divisor
   * @returns {Kuery}
   */
  remainder (dividend: any, divisor: ?any): Kuery { return this.binary("§%", dividend, divisor); }

  /**
   * To-step which advances to the negation of the given valked operand.
   * Sugar for unary("§-"). See unary
   *
   * @returns {Kuery}
   */
  negate (operand: ?any): Kuery { return this.unary("§negate", operand); }

  /**
   * To-step which advances to the valked given value exponentiated to the valked given exponent.
   * Sugar for binary("§**", exponent). See binary
   *
   * @param {primitive || Kuery} exponent
   * @returns {Kuery}
   */
  exponentiate (value: any, exponent: ?any): Kuery { return this.binary("§**", value, exponent); }

  // Bitwise operators

  /**
   * To-step which advances to the bitwise AND of the operands (no short-circuit).
   * Sugar for reduced binary("§&", operand). See binary
   *
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  bitAND (firstOperand: any, ...operands: any[]): Kuery {
    return this.chainBinary("§&", firstOperand, operands);
  }

  /**
   * To-step which advances to the bitwise OR of the operands (no short-circuit).
   * Sugar for reduced binary("§|", operand). See binary
   *
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  bitOR (firstOperand: any, ...operands: any[]): Kuery {
    return this.chainBinary("§|", firstOperand, operands);
  }

  /**
   * To-step which advances to the bitwise XOR of the operands.
   * Sugar for binary("§^", divisor). See binary
   *
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  bitXOR (left: any, right: ?any): Kuery {
    return this.binary("§^", left, right);
  }

  /**
   * To-step which advances to the bitwise NOT of the operand.
   * Sugar for unary("§~", divisor). See unary
   *
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  bitNOT (operand: ?any): Kuery {
    return this.unary("§~", operand);
  }

  /**
   * To-step which advances to the bitwise shift-left of the given left by the given right.
   * Sugar for binary("§<<", divisor). See binary
   *
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  bitShiftLeft (left: any, right: ?any): Kuery {
    return this.binary("§<<", left, right);
  }

  /**
   * To-step which advances to the bitwise shift-right of the given left by the given right.
   * Sugar for binary("§>>", divisor). See binary
   *
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  bitShiftRight (left: any, right: ?any): Kuery {
    return this.binary("§>>", left, right);
  }

  /**
   * To-step which advances to the bitwise shift-right of the given left by the given right, filling
   * left bits with zeroes instead of sign.
   * Sugar for binary("§>>>", divisor). See binary
   *
   * @param {primitive || Kuery} operand
   * @returns {Kuery}
   */
  bitShiftZeroFillRight (left: any, right: ?any): Kuery {
    return this.binary("§>>>", left, right);
  }

  // Kuery introspection, manipulation and conversions

  /**
   * Converts the Kuery into the VAKON form. Not a to-step even though it has the to-prefix.
   *
   * @returns
   */
  toVAKON (): any {
    return this.isActiveKuery() ? this._toVAKON() : null;
  }
  toJSON (): any { return this.toVAKON(); }

  toDumpify (options: ?any): string {
    return dumpify(this.toVAKON(), options);
  }


  /**
   * Returns an identifier for this kuery in this execution context.
   * Two identical kueries might have the same id but different kueries are guaranteed to have
   * different id's.
   * TODO(iridian): see if the promise about possibly same id can be guaranteed, so that identical
   * kueries within a process will always have the same id.
   *
   * @returns
   *
   * @memberof Kuery
   */
  kueryId () { return this.toVAKON(); }

  headType () { return this._headType; }
  setHeadType (headType: ?string) {
    if (typeof headType === "undefined") return this;
    invariantify(!this._headType, "Kuery.headType already set", this._headType);
    this._headType = headType;
    return this;
  }

  isActiveKuery () { return this._mode; }
  isRawVAKON () { return this._mode === "rawVAKON"; }
  isPath () { return this._mode === "path"; }
  isExpression () { return this._mode === "expression"; }

  expressionName () { return this.toVAKON()[0]; }
  expressionArgumentVAKONs () { return this.toVAKON().slice(1); }

  pathLength () { return this._pathSteps.length; }
  pathStep (index: number) { return this._pathSteps[index]; }
  pathSlice (begin: number, end: ?number): Kuery {
    invariantifyString(this._mode, "Kuery.mode", { value: "path" });
    return this._newPath(this._pathOperator, this._pathSteps.slice(begin, end));
  }
  pathConcat (...values: Kuery[]): Kuery {
    const ret = this._addStepsTypeless(false, ...values.reduce((result, value) => (
        (!value || !value.isActiveKuery())
            ? result
            : result.concat(value._pathSteps || value)),
        []
    ));
    if (this._headType) ret.setHeadType(this._headType);
    return ret;
  }

  // Implementation details

  constructor (mode: string = "", context: Object, first: any, second: any) {
    this._mode = mode;
    this._root = context || this;
    this._VAKON = undefined;
    switch (this._mode) {
      case "rawVAKON":
        invariantify(first !== undefined, "rawVAKON can't be undefined");
        this._VAKON = first;
        break;
      case "path":
        this._pathOperator = first;
        this._pathSteps = second;
        break;
      case "expression":
        this._expressionName = first;
        this._expressionArgs = second;
        break;
      default: break;
    }
  }

  _mode: string;
  _root: Object;
  _VAKON: any;
  _pathSteps: ?any[];
  _expressionName: ?any;
  _expressionArgs: ?any[];

  _newKuery (type: string, first: any, second?: any): Kuery {
    return new this.constructor(type, this._root, first, second);
  }
  _newRawVAKON (value: any, type: ?string): Kuery {
    return ((value instanceof Kuery) ? value : this._newKuery("rawVAKON", value))
        .setHeadType(type);
  }
  _newExpression (stepName: string, argumentKueries: any[]): Kuery {
    invariantifyArray(argumentKueries, "VALK._newExpression.argumentKueries");
    return this._newKuery("expression", stepName, argumentKueries);
  }
  _newPath (pathOperator: string, stepKueries: any[]) {
    return this._newKuery("path", pathOperator, stepKueries);
  }

  _addRawVAKON (step: any, type: ?string): Kuery {
    return this._addStep(this._newRawVAKON(step, type));
  }
  _addPathRawVAKON (step: any, type: ?string): Kuery {
    return this._addStep(this._newRawVAKON(step, type), undefined, true);
  }
  _addExpression (operator: string, params: any[]): Kuery {
    return this._addStep(this._newExpression(operator, params));
  }
  _addPath (pathOperator: string, stepKueries: any[]): Kuery {
    return this._addStep(this._newPath(pathOperator, stepKueries));
  }

  _addStep (step: any, headType: ?string, forcePath: ?boolean): Kuery {
    const ret = this._addStepsTypeless(forcePath, step);
    if (headType) ret._headType = headType;
    return ret;
  }

  _addStepsTypeless (forcePath: boolean, step: any, ...steps: any) {
    try {
      if (step === undefined) return this;
      if (forcePath || this.isActiveKuery() || steps.length) {
        return this._newPath((this._pathOperator || "§->"),
            [...(this._pathSteps || (this.isActiveKuery() && [this]) || []), step, ...steps]);
      }
      return this._newRawVAKON(step);
    } catch (error) {
      throw wrapError(error, `During ${this.constructor.name}().addSteps(), with:`,
          "\n\tstep:", step,
          "\n\tremaining steps:", steps);
    }
  }

  _toVAKON () {
    try {
      if (typeof this._VAKON === "undefined") {
        switch (this._mode) {
          case "path":
            this._VAKON = [this._pathOperator];
            for (const step of (this._pathSteps || [])) this._VAKON.push(toVAKON(step));
            /*
            if ((typeof this._VAKON[0] === "string") || (this._pathOperator !== "§->")) {
              this._VAKON = [this._pathOperator, ...this._VAKON];
            }
            */
            break;
          case "expression": {
            const args = this._expressionArgs.map(arg => {
              const vakon = (arg instanceof Kuery ? arg : this._root.toTemplate(arg)).toVAKON();
              // All expressions treat their arguments as literals, so
              // if a kuery VAKON is a non-object we must wrap it inside a path.
              if (typeof vakon !== "object") return ["§->", vakon];
              if (vakon && (vakon[0] === "§'") && (typeof vakon[1] !== "object")) {
                // A literal expression with primitive value can be
                // used directly
                return vakon[1];
              }
              return vakon;
            });
            this._VAKON = [this._expressionName, ...args];
            break;
          }
          default:
            throw new Error(`kuery.toVAKON: mode '${this._mode}' not implemented`);
        }
      }
      return this._VAKON;
    } catch (error) {
      throw wrapError(error, "During Kuery._toVAKON",
          "\n\tkuery:", ...dumpObject(this));
    }
  }
}

export function toVAKON (kueryOrVAKON: Kuery | any) {
  if (kueryOrVAKON instanceof Kuery) return kueryOrVAKON.toVAKON();
  return kueryOrVAKON;
}

function _recurseToVAKON (kuery: Kuery | any) {
  return trivialClone(kuery, (value, key, object, descriptor) => {
    if (typeof value === "function") {
      descriptor.skip = true;
      return undefined;
    }
    if ((!value || (typeof value !== "object")
        || Array.isArray(value) || (Object.getPrototypeOf(value) === Object.prototype))) {
      return undefined;
    }
    if (value instanceof Kuery) return value.toVAKON();
    const hostRef = tryHostRef(value);
    if (hostRef) return ["§vrl", hostRef.toJSON()];
    return value;
  });
}

export function dumpObject (value) {
  const ret = _dumpObject(value);
  if (ret.length) return ret;
  if (isHostRef(value)) {
    const denormalized = (typeof value.get === "function") ? value
        : ((typeof value._singular === "object") && typeof value._singular.get === "function")
            ? value._singular
        : null;
    const name = denormalized && denormalized.get("name");
    if (name) ret.unshift(`'${name}'`);
    const dumpifiable = value._singular ? value
        : (typeof value.get === "function") && value.get("id");
    if (dumpifiable) ret.unshift(String(dumpifiable));
    return ret;
  }
  return ret;
}

export function dumpScope (scope) {
  return scope && (inBrowser() ? scope : `scope hidden with ${Object.keys(scope).length} keys`);
}

export function dumpKuery (kuery: Object, shouldBeaumpify) {
  if ((typeof kuery !== "object") || (kuery === null)) {
    return [beaumpify(kuery)];
  }
  const vakon = kuery.toJSON ? kuery.toJSON() : kuery;
  if (!inBrowser()) return ["", shouldBeaumpify ? beaumpify(vakon) : dumpify(vakon)];
  return [vakon, { vakonText: beaumpify(vakon) }];
}
