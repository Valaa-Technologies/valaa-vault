// @flow

import ProphetTestHarness, { createProphetTestHarness, createProphetOracleHarness }
    from "~/prophet/test/ProphetTestHarness";
import { obtainAspect } from "~/prophet/tools/EventAspects";

import EngineTestAPI from "~/engine/test/EngineTestAPI";
import ValaaEngine from "~/engine/ValaaEngine";
import type Vrapper from "~/engine/Vrapper";
import Cog from "~/engine/Cog";
import { builtinSteppers } from "~/engine/VALEK";
import extendValaaSpace from "~/engine/ValaaSpace";

import baseEventBlock from "~/engine/test/baseEventBlock";

import { isPromise } from "~/tools";

export function createEngineTestHarness (options: Object, ...commandBlocks: any) {
  const ret = createProphetTestHarness({
    name: "Engine Test Harness", ContentAPI: EngineTestAPI, TestHarness: EngineTestHarness,
    corpusOptions: { builtinSteppers },
    ...options,
  }, ...(options.claimBaseBlock ? [baseEventBlock] : []), ...commandBlocks);
  if (isPromise(ret)) {
    throw new Error(`createProphetTestHarness returned a promise inside ${
      ""} createEngineTestHarness. Use createEngineOracleHarness for async support instead.`);
  }
  return ret;
}

export function createEngineOracleHarness (options: Object, ...commandBlocks: any) {
  return createProphetOracleHarness({
    name: "Engine Oracle Harness", ContentAPI: EngineTestAPI, TestHarness: EngineTestHarness,
    corpusOptions: { builtinSteppers },
    ...options,
  }, ...(options.claimBaseBlock ? [baseEventBlock] : []), ...commandBlocks);
}

export default class EngineTestHarness extends ProphetTestHarness {
  createValker () {
    this.engine = new ValaaEngine({
      name: "Test ValaaEngine",
      logger: this.getLogger(),
      prophet: this.prophet, // created by createCorpus of ProphetTestHarness
      verbosity: this.getVerbosity(),
    });
    const rootScope = this.engine.getRootScope();
    extendValaaSpace(rootScope, this.engine.getHostObjectDescriptors(), this.schema);
    // TODOO(iridian): This should be in InspireTestHarness, but there is no such thing.
    rootScope.Valaa.InspireGateway = {
      RemoteAuthorityURI: "valaa-testing:",
      LocalAuthorityURI: "valaa-local:",
    };
    this.createds = new TestCollectCREATEDCog();
    this.engine.addCog(this.createds);
    this.entities = this.createds.Entity;
    this.discourse = this.chronicler = this.engine.discourse;
    this.discourse.setAssignCommandId((command) => {
      obtainAspect(command, "command").id = `test-cid-${this.nextCommandIdIndex++}`;
    });
    return this.engine.discourse;
  }

  runValaaScript (self: any, valaaScriptBody: string, options: Object = {}) {
    options.scope = Object.assign(
        Object.create(this.engine.getLexicalScope()),
        options.scope || {});
    return super.runValaaScript(self, valaaScriptBody, options);
  }
}

export class TestCollectCREATEDCog extends Cog {
  constructor () {
    super({ name: "Test Collect CREATED's Cog" });
    this.TestScriptyThing = {};
  }

  onEventCREATED (vResource: Vrapper) {
    const typeName = vResource.getTypeName({ require: false });
    (this[typeName] || (this[typeName] = {}))[vResource.getRawId()] = vResource;
  }
}
