// @flow

import { denoteDeprecatedValOSBuiltin, denoteValOSBuiltinWithSignature, denoteValOSKueryFunction }
    from "~/raem/VALK";

import VALEK, { extractFunctionVAKON } from "~/engine/VALEK";

import { dumpObject, wrapError } from "~/tools";

const symbols = {
  getRelations: Symbol("Relatable.getRelations"),
  getRelationsTargets: Symbol("Relatable.getRelationTargets"),
  setRelations: Symbol("Relatable.setRelations"),
  getIncomingRelations: Symbol("Relatable.getIncomingRelations"),
  getIncomingRelationsSources: Symbol("Relatable.getIncomingRelationSources"),
  setIncomingRelations: Symbol("Relatable.setIncomingRelations"),
};

export default {
  isGlobal: true,
  symbols,
  typeFields: {
    getRelationsOf: denoteDeprecatedValOSBuiltin(
        "[Relatable.getRelations](name, ...additionalConditions)",
        `returns an array which contains all Relation objects which have given *name*, have given ${
            ""} *relatable* as their host *Relation.source* field value and which fullfill all ${
            ""} constaints of given additionalConditions`
    )(function getRelationsOf (relatable, name, ...additionalConditions) {
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
    getIncomingRelationsOf: denoteDeprecatedValOSBuiltin(
        "[Relatable.getIncomingRelations](name, ...additionalConditions)",
        `returns an array which contains all Relation objects which have given *name*, have *this*${
            ""} relatable as their host *Relation.target* field value and which fullfill all ${
            ""} constaints of given additionalConditions`
    )(function getIncomingRelationsOf (entity, name, ...additionalConditions) {
      return this.getFieldOf(entity,
          VALEK.incomingRelations(name,
              ...additionalConditions.map(condition =>
                  VALEK.fromVAKON(extractFunctionVAKON(condition)))));
    }),
  },
  prototypeFields: {
    [symbols.getRelations]: denoteValOSKueryFunction(
        `returns an array which contains all outgoing (connected or not) *Relation* resources${
            ""} which have the given *name* as their *Describable.name*${
            ""} and which satisfy all constraints of the optionally given *additionalConditions*.${
            ""} Outgoing relations are listed in *Relatable.relations*${
            ""} and they all have *this* *Relatable* as their *Relation.source*.${
            ""} Note: all matching relations are selected, even those in unconnected partitions.`
    )(function getRelations (name, ...additionalConditions) {
      return VALEK.relations(name,
          ...additionalConditions.map(condition =>
              VALEK.fromVAKON(extractFunctionVAKON(condition)))
      ).toVAKON();
    }),
    [symbols.getRelationsTargets]: denoteValOSKueryFunction(
        `returns an array which contains all *Relation.target* *Relatable* resources of the ${
            ""} selected outgoing *Relation* resources.${
            ""} This selection is defined identically to *Relatable.getRelations*${
            ""} using the given *name* and the optionally given *additionalConditions*.`
    )(function getRelationsTargets (name, ...additionalConditions) {
      return VALEK.relationTargets(name,
          ...additionalConditions.map(condition =>
              VALEK.fromVAKON(extractFunctionVAKON(condition)))
      ).toVAKON();
    }),
    [symbols.setRelations]: denoteValOSBuiltinWithSignature(
        `Replaces all relations with given *name* with relations in given *newRelations* sequence.${
            ""} This can be used to reorder the relations, as even if no entries are actually${
            ""} removed or added (if the new set has the same entries as the existing set), their${
            ""} order will be changed to match the order in the new sequence.`
    )(function setRelations (name, newRelations: any[]) {
      try {
        return this.replaceWithinField("relations",
            this.get(VALEK.relations(name), { discourse: this.__callerValker__ }),
            newRelations, { discourse: this.__callerValker__ });
      } catch (error) {
        throw wrapError(error, `During ${this.constructor.name}\n .setRelations('${name}'), with:`,
            "\n\tnewRelations:", ...dumpObject(newRelations));
      }
    }),
    [symbols.getIncomingRelations]: denoteValOSKueryFunction(
        `returns an array which contains all incoming, connected *Relation* resources${
            ""} which have the given *name* as their *Describable.name*${
            ""} and which satisfy all constraints of the optionally given *additionalConditions*.${
            ""} Incoming relations are listed in *Relatable.incomingRelations*${
            ""} and they all have *this* *Relatable* as their *Relation.target*.${
            ""} Note: only relations inside connected partitions are listed${
            ""} (even though some might be inactive, f.ex. if they have an inactive prototype).`
    )(function getIncomingRelations (name, ...additionalConditions) {
      return VALEK.incomingRelations(name,
          ...additionalConditions.map(condition =>
              VALEK.fromVAKON(extractFunctionVAKON(condition)))
      ).toVAKON();
    }),
    [symbols.getIncomingRelationsSources]: denoteValOSKueryFunction(
        `returns an array which contains all *Relation.source* *Relatable* resources of the ${
            ""} selected incoming *Relation* resources.${
            ""} This selection is defined identically to *Relatable.getIncomingRelations*${
            ""} using the given *name* and the optionally given *additionalConditions*.`
    )(function getIncomingRelationsSources (name, ...additionalConditions) {
      return VALEK.incomingRelationSources(name,
          ...additionalConditions.map(condition =>
              VALEK.fromVAKON(extractFunctionVAKON(condition)))
      ).toVAKON();
    }),
    [symbols.setIncomingRelations]: denoteValOSBuiltinWithSignature(
        `Replaces all incoming relations with given *name* with relations in given${
            ""} *newIncomingRelations* sequence.${
            ""} This can be used to reorder the relations, as even if no entries are actually${
            ""} removed or added (if the new set has the same entries as the existing set), their${
            ""} order will be changed to match the order in the new sequence.`
    )(function setIncomingRelations (name, newIncomingRelations: any[]) {
      try {
        return this.replaceWithinField("incomingRelations",
            this.get(VALEK.incomingRelations(name), { discourse: this.__callerValker__ }),
            newIncomingRelations, { discourse: this.__callerValker__ });
      } catch (error) {
        throw wrapError(error, `During ${this.constructor.name}\n .setIncomingRelations('${name
            }'), with:`,
            "\n\tnewIncomingRelations:", ...dumpObject(newIncomingRelations));
      }
    }),
  },
};
