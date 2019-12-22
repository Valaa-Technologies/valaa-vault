// @flow

import SourcererTestHarness, { createSourcererTestHarness, createSourcererOracleHarness }
    from "~/sourcerer/test/SourcererTestHarness";
import { obtainAspect } from "~/sourcerer/tools/EventAspects";

import EngineTestAPI from "~/engine/test/EngineTestAPI";
import Engine from "~/engine/Engine";
import Cog from "~/engine/Cog";
import { engineSteppers } from "~/engine/VALEK";
import extendValosheath from "~/engine/valosheath";

import baseEventBlock from "~/engine/test/baseEventBlock";

import { isPromise } from "~/tools";

export function createEngineTestHarness (options: Object, ...commandBlocks: any) {
  const ret = createSourcererTestHarness({
    name: "Engine Test Harness", ContentAPI: EngineTestAPI, TestHarness: EngineTestHarness,
    corpus: { steppers: engineSteppers },
    ...options,
  }, ...(options.claimBaseBlock ? [baseEventBlock] : []), ...commandBlocks);
  if (isPromise(ret)) {
    throw new Error(`createSourcererTestHarness returned a promise inside ${
      ""} createEngineTestHarness. Use createEngineOracleHarness for async support instead.`);
  }
  return ret;
}

export function createEngineOracleHarness (options: Object, ...commandBlocks: any) {
  return createSourcererOracleHarness({
    name: "Engine Oracle Harness", ContentAPI: EngineTestAPI, TestHarness: EngineTestHarness,
    corpus: { steppers: engineSteppers },
    ...options,
  }, ...(options.claimBaseBlock ? [baseEventBlock] : []), ...commandBlocks);
}

export default class EngineTestHarness extends SourcererTestHarness {
  createValker () {
    this.engine = new Engine({
      name: "Test Engine",
      logger: this.getLogger(),
      sourcerer: this.sourcerer, // created by createCorpus of SourcererTestHarness
      verbosity: this.getVerbosity(),
    });
    const rootScope = this.engine.getRootScope();
    extendValosheath(rootScope, this.engine.getHostDescriptors(), this.engine.discourse);
    // TODOO(iridian): This should be in InspireTestHarness, but there is no such thing.
    rootScope.valos.GatewayConfig = {
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

  runValoscript (self: any, valoscriptBody: string,
      extendScope: Object = {}, options: Object = {}) {
    options.scope = Object.create(this.engine.getLexicalScope());
    return super.runValoscript(self, valoscriptBody, extendScope, options);
  }
}

export class TestCollectCREATEDCog extends Cog {
  constructor () {
    super({ name: "Test Collect CREATED's Cog" });
    this.TestScriptyThing = {};
  }

  onEventCREATED (passage: Object) {
    const typeName = passage.vProtagonist.getTypeName({ require: false });
    if (!this[typeName]) this[typeName] = {};
    this[typeName][passage.vProtagonist.getRawId()] = passage.vProtagonist;
  }
}
