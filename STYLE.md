
# ValOS style guide
[//]: # (don't edit auto-generated file - generated at @valos/vault root with)
[//]: # (vlm --markdown . require packages/toolset-vault/template.vdon/STYLE.vdon > STYLE.md)
The ValOS style is split into three main sections: general semantic
principles, informal text production guidelines and formal
linter-enforceable style rules.
Additional files specifying formal style rules:
- @valos/toolset-vault/shared/.eslintrc.js
- @valos/toolset-vault/templates/.editorconfig

Note: while formal ValOS linter rules are formally based on airbnb
style there is a lot of divergence in practice.

Like all ValOS specifications this style guide applies only to Valaa
Open System packages. Other Valaa ecosystem packages and projects are
free to deviate or use their own styles and principles without
affecting Valaa compatibility.

## 1. Semantic principles
This section lists generic semantic ValOS design principles and their
rationales.

### 1.1. Use ECMAScript everywhere
ECMAScript should be used as the text-based turing language of choice
in all ValOS contexts (ValaaScript is acceptable as an ECMAScript
derivative).

ValOS ecosystem as a distributed, multitenant architecture is complex
on its own. ECMAScript has advanced in strides across the spectrum. ES6
improved the language features and V8 spearheaded performance together
bringing ECMAScript to the big boys league. Package management
solutions constantly improve and innovate around the npmjs.org core and
both frontend and backend library supply keeps expanding.

These advances makes it feasible to stick to one language, avoid
complexities caused by language interoperability issues as well as
maximize code reuse.

When solutions necessitate other languages, they should be implemented
in following order of preference:
1. Transpiled into ECMAScript. This allows full native reuse of the
   solution throughout all of Valaa ecosystem and potentially provides
   value for the JS community at large too. Unfortunately not often
   feasible due to lack of isolation or maintenance reasons.
2. Embedded within ECMAScript-based service or library. This allows
   the API layer to reuse existing validation, (de)serialization and
   similar code, reducing code duplication and minimizing bugs.
3. As a service with a ValaaSpace API. This is usually done as a
   plugin of some existing ValOS authority with a plugin API
   specifically built for this purpose. This can also be done by
   implementing the event stream API of some authority. Or this can be
   done as a full Valaa (non-ValOS) authority. Note that while
   ValaaSpace API is most useful for end users the transpilation and
   embeddment solutions are still higher priority. This is because they
   can also be easily exposed via ValaaSpace API's but they providing
   other benefits as well.
4. As a RESTful service which consumes and produces I-JSON. While
   perfectly acceptable solution as part of the larger Valaa ecosystem
   this is least likely to be accepted as part of ValOS actual. At the
   very least this solution should prove that it reduces overall
   complexity. See next chapter about I-JSON.

### 1.2. Create custom dialects on top I-JSON for data interchange
JSON is the pre-eminent ValOS configuration and data interchange
format. All ValOS tools must be able to both consume and produce their
essential data input and output as
[I-JSON messages](https://tools.ietf.org/html/rfc7493).
Alternatively the input or output can be in the form of ECMAScript
objects as long as the following roundtrip conditions hold. Firstly,
ECMA-262 JSON.stringify on any such input/output object must return a
conforming I-JSON message. Secondly, if this message is then passed to
ECMA-262 JSON.parse and the resulting object is used in place of the
original input/output object the system must behave semantically
identically.

Directly require()-able JSON files and protocols which give directly
JSON.parse()-able I-JSON messages should be preferred. Other solutions
can be used especially if they simplify the overall design, like
[JSON streaming](https://en.wikipedia.org/wiki/JSON_streaming)
for appendable log files, internet protocols for streaming events, etc.

Whenever a JSON is used as the interchange for a particular domain a
dialect should be named and defined.
ValOS itself introduces several: VAKON for Kueries, VDON for
documentation, Revelation VSON for the revela.json inspire revelations
and Events VSON for the universal command and truth events.
All ValOS JSON dialects (and only them) follow this convention: 'V*ON'
or 'name + VSON' ('Valaa System Object Notation'). Only the fundamental
dialects get their own abbreviation.
Some dialects make use of some shared tooling like
@valos/tools/deepExpand

### 1.3. Use base64url to serialize binary data as text
[base64url](https://tools.ietf.org/html/rfc4648#section-5)
(a base64 variant) must be used when binary content needs to be encoded
as text. While main binary content is stored inside Media resources
which has its dedicated pathways this need can still arise. This is
recommended by I-JSON and a notable Valaa example is derived resource
ID creation via hash algorithms (which operate on binary content) which
should be url-compatible.

## 2. Informal text production style guidelines
This section lists informal style rules which relate to production of
text. That text can be human or machine written code, command line or
log output, or even documentation. Any rule that can, should be
expressed as a formal eslint or editor rule.

### 2.1. Style CSS according to camelCase BEM.info rules
[BEM (Block, Element, Modifier)](https://en.bem.info/methodology/quick-start/)
is a component-based approach to web development. ValOS uses
[the camelCase naming convention variant](https://en.bem.info/methodology/naming-convention/) with
option library-scope prefix described below. BEM principles should be
followed more generally as well whenever applicable.

#### Scope prefixes are separated from Block name with two underscores
In addition to its own styles @valos/inspire hosts several programs
within the same page which share the same global css namespace. BEM
naming is extended to allow a block name to be prefixed with a scope
name and two underscores like so: 'inspire__' to prevent conflicts.

### 2.2. Formatting non-structured inline documentation in CLI contexts
One of the two options must be used for newlines in individual
documentation pieces:
1. manually line-break with max 71 characters per line.
2. only separate paragraphs and leave line-breaking to the CLI tool.
This choice should be followed consistently everywhere within the same
tool or document.

### 2.3. Pluralize collections, singularize things
The decision on when a thing with sub-things is a collection of
homogenous entries (and should maybe be pluralized) and when is such a
thing a single entity with properties is sometimes hard.
Sometimes the context fully specifies the naming principle. F.ex.
database table names should always be singular: while they are
collections, they are that _always_ and the convention to name them
singular simplifies thinking and is often more intuitive as well:
'Person.name' as a reference to a column is better than plural
'Persons.name'.
Other contexts are less helpful. Directories containing files on one
hand and javascript objects with properties on the other are often used
to represent both singular things with properties as well as
collections of named entries.

The guideline is to consider the coupling of the sub-things in the
context where the parent thing is used. If the sub-things have low
coupling to each other then the parent thing should be treated as a
collection and a plural name chosen for it.

Examples:
```javascript
  const partygoer = { name: "mack", movie: "Plan 9", song: "Ob-La-Di" };
const partygoers = { mack: { name: "mack", movie: "Plan 9", song:
"Ob-La-Di" }, dunlop: { name: "dunlop", movie: "BF Earth", song:
"Friday" }, };
 ```

'partygoer' is singular because the name, movie and song have high
coupling in the context of a party: this object is perhaps used to sort
people to groups or create ice-breaker info tags. The object represents
a single thing: we choose a singular name.
'partygoers' on the other hand is plural because its entries, 'mack'
and 'dunlop' have the same structural layout and either could be
removed without making the 'partygoers' meaningless. It is likely to be
iterated instead of directly accessed by property. We name it as a
collection of 'partygoer' entries as opposed to a singular concept like
'party'

```javascript
  const favorites = { movie: "Plan 9", song: "Ob-La-Di" };
db.updateNoSQLTable("person", { name: "mack", favorites });
 ```

Here 'favorites' is plural: while it has the similar data as in the
party example the context and grouping is different. Maybe this schema
is more long-term and the schema needed to facilitate addition of new
favorites. When the move and song are grouped together (excluding the
'name') we realize that in the previous example the coupling was
between each favorite and the partygoer itself, not between the
favorites themselves. Now it is clearly a collection of entries and
named as such.
@valos/tools is plural as it is a collection of largely independent
tools.

## 3. Git branch, versioning and release workflows
The following guidelines describe the current practice but should be
still considered only as a proposal.

### 3.1. Vault semver version number is shared between all packages
Vault version numbers follow [semver 2](https://semver.org/spec/v2.0.0.html)
specification. Vault uses lerna locked mode versioning for its packages
by default. Only actually modified packages will have their version
numbers updated when released. When a package is updated however the
version number then potentially jumps over any skipped versions to
match the shared vault version.

### 3.2. Vault git branch naming and semantics
Branches.

#### 3.2.1. *release/_<major>_._<minor>_* branches track the supported releases
These branches will only get (possibly back-ported) patch commits and
are never rebased.
The version number in lerna.json will not have prerelease or build
fields and its lerna auto-increment is configured as patch.
Tests, lints and any other release conditions must always pass.

A release branch is deleted once support for that particular release
ends, ie. when that release will no longer receive patches.

#### 3.2.2. *feature/_<feature-name>_* branches track isolated feature development
Feature owner is free to pick whichever workflow fits the dynamics of
that particular feature development best. No matter the workflow that
is chosen the final pull request must rebased on top of the prerelease
branch.

#### 3.2.3. *master* tracks latest release branch
An alias for the most recent release branch. Follows all the rules of a
release branch.

#### 3.2.4. *patch/_<patch-name>_* branches track bugfixes and _quickie features_
Similar to feature branches but the target is the master branch (and
thus by definition the most recent release branch).

The content must obey semver patch version rules. Note that major
version 0 allows patch versions to introduce new functionality. These
_quickie features_ facilitate rapid development during prototyping
stage only and thus are not allowed for major versions >= 1.

#### 3.2.5. *prerelease/_<major>_._<minor>_* branch tracks the upcoming release
This branch (there shall be only one) is the target of current feature
development.
It's never rebased except optionally once right before release. It
receives patch commits from the most current release branch via merges.
It receives feature commits and pull requests via rebase-merges.

Its main version number in lerna.json and package.json has a
*-prerelease._<index>_* suffix and its lerna auto-increment is
correspondingly configured as prerelease.

When being released may be squelched and rebased on top of master.
Alternatively it's left as-is to be the target of fast-forward later. A
release commit will be added to contain lerna.json and other release
version number changes. The branch can then be renamed as the
appropriate release branch, and master fast-forwarded to track it.
