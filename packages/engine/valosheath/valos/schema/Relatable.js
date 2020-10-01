// @flow

import { denoteValOSCallable, denoteValOSKueryFunction, denoteDeprecatedValOSCallable }
    from "~/raem/VALK";
import { qualifiedSymbol } from "~/tools/namespace";

import { extractFunctionVAKON } from "~/script";

import VALEK from "~/engine/VALEK";

import { dumpObject, wrapError } from "~/tools";

const symbols = {
  getRelations: qualifiedSymbol("V", "getRelations"),
  getRelationsTargets: qualifiedSymbol("V", "getRelationTargets"),
  setRelations: qualifiedSymbol("V", "setRelations"),
  getIncomingRelations: qualifiedSymbol("V", "getIncomingRelations"),
  getIncomingRelationsSources: qualifiedSymbol("V", "getIncomingRelationSources"),
  setIncomingRelations: qualifiedSymbol("V", "setIncomingRelations"),
};

export default {
  isGlobal: true,
  symbols,
  typeFields: {
    getRelationsOf: denoteDeprecatedValOSCallable([
`Returns an array which contains all Relation objects of given
*relatable* which have the given *name*`,
`Returned relation objects have given *relatable* as their host
*Relation.source* field value and which fullfill all constaints of
given additionalConditions`,
    ], [
      "DEPRECATED", "V:getRelations",
    ])(function getRelationsOf (relatable, name, ...additionalConditions) {
      try {
        return this.getFieldOf(relatable,
            VALEK.relations(name,
                ...additionalConditions.map(condition =>
                    VALEK.fromVAKON(extractFunctionVAKON(condition)))));
      } catch (error) {
        throw wrapError(error, `During ${this.constructor.name}\n .getRelationsOf, with:`,
            "\n\tthis:", this,
            "\n\trelatable:", relatable,
            "\n\tname:", name,
            "\n\tadditionalConditions:", additionalConditions);
      }
    }),
    getIncomingRelationsOf: denoteDeprecatedValOSCallable([
`Returns an array which contains all Relation objects which have the
given *name*`,
`have *this* relatable as their host *Relation.target* field value and
which fullfill all constaints of given additionalConditions`,
    ], [
      "DEPRECATED", "V:getIncomingRelations",
    ])(function getIncomingRelationsOf (entity, name, ...additionalConditions) {
      return this.getFieldOf(entity,
          VALEK.incomingRelations(name,
              ...additionalConditions.map(condition =>
                  VALEK.fromVAKON(extractFunctionVAKON(condition)))));
    }),
  },
  prototypeFields: {
    [symbols.getRelations]: denoteValOSKueryFunction([
`Returns an array of all outgoing relations with the given *name* as
their V:name.`,
`Outgoing relations are all V:Relation resources owned by *this*
V:Relatable in its V:relations and which have *this* as their V:source.

If no *name* is given returns all outgoing relations.

Note: all matching relations are selected, even those in unconnected
chronicles.`,
        ],
        { cachingArguments: 1 },
    )(function getRelations (name, ...additionalConditions) {
      return VALEK.relations(name,
          ...additionalConditions.map(condition =>
              VALEK.fromVAKON(extractFunctionVAKON(condition)))
      ).toVAKON();
    }),
    [symbols.getRelationsTargets]: denoteValOSKueryFunction([
`Returns an array of all the V:target resources of those outgoing
relations which have the given *name* as their V:name.`,
`This method is identical to V:getRelations except that the
returned array contains the V:target resources instead of the relations
themselves.`,
        ],
        { cachingArguments: 1 },
    )(function getRelationsTargets (name, ...additionalConditions) {
      return VALEK.relationTargets(name,
          ...additionalConditions.map(condition =>
              VALEK.fromVAKON(extractFunctionVAKON(condition)))
      ).toVAKON();
    }),
    [symbols.setRelations]: denoteValOSCallable([
`Replaces all relations with given *name* with relations in given
*newRelations* sequence.`,
`This can be used to reorder the relations, as even if no entries are
actually removed or added (if the new set has the same entries as the
existing set), their order will be changed to match the order in the
new sequence.`,
    ])(function setRelations (name, newRelations: any[]) {
      try {
        return this.replaceWithinField("relations",
            this.step(VALEK.relations(name), { discourse: this.__callerValker__ }),
            newRelations, { discourse: this.__callerValker__ });
      } catch (error) {
        throw wrapError(error, `During ${this.constructor.name}\n .setRelations('${name}'), with:`,
            "\n\tnewRelations:", ...dumpObject(newRelations));
      }
    }),
    [symbols.getIncomingRelations]: denoteValOSKueryFunction([
`Returns an array of all incoming, connected relations with the given
*name* as their V:name.`,
`Incoming relations are all V:Relation resources that appear in the
V:incomingRelations and which have *this* as their V:target.

Note: only relations inside connected chronicles are listed (even
though some might be inactive, f.ex. if they have an inactive prototype).`,
        ],
        { cachingArguments: 1 },
    )(function getIncomingRelations (name, ...additionalConditions) {
      return VALEK.incomingRelations(name,
          ...additionalConditions.map(condition =>
              VALEK.fromVAKON(extractFunctionVAKON(condition)))
      ).toVAKON();
    }),
    [symbols.getIncomingRelationsSources]: denoteValOSKueryFunction([
`Returns an array of all V:source resources of those incoming relations
which have the given *name* as their V:name`,
`This method is identical to V:getIncomingRelations except that the
returned array contains V:source resources instead of the relations
themselves.`,
        ],
        { cachingArguments: 1 },
    )(function getIncomingRelationsSources (name, ...additionalConditions) {
      return VALEK.incomingRelationSources(name,
          ...additionalConditions.map(condition =>
              VALEK.fromVAKON(extractFunctionVAKON(condition)))
      ).toVAKON();
    }),
    [symbols.setIncomingRelations]: denoteValOSCallable([
`Replaces all incoming relations with given *name* with relations in
given *newIncomingRelations* sequence.`,
`This can be used to reorder the relations, as even if no entries are
actually removed or added (if the new set has the same entries as the
existing set), their order will be changed to match the order in the
new sequence.`,
    ])(function setIncomingRelations (name, newIncomingRelations: any[]) {
      try {
        return this.replaceWithinField("incomingRelations",
            this.step(VALEK.incomingRelations(name), { discourse: this.__callerValker__ }),
            newIncomingRelations, { discourse: this.__callerValker__ });
      } catch (error) {
        throw wrapError(error, `During ${this.constructor.name}\n .setIncomingRelations('${name
            }'), with:`,
            "\n\tnewIncomingRelations:", ...dumpObject(newIncomingRelations));
      }
    }),
  },
};
