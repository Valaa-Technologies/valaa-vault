// @flow

import ProphetTestHarness, { createProphetTestHarness, createProphetOracleHarness }
    from "~/prophet/test/ProphetTestHarness";

import EngineTestAPI from "~/engine/test/EngineTestAPI";
import ValaaEngine from "~/engine/ValaaEngine";
import type Vrapper from "~/engine/Vrapper";
import Cog from "~/engine/Cog";
import { builtinSteppers } from "~/engine/VALEK";
import extendValaaSpace from "~/engine/ValaaSpace";

import baseEventBlock from "~/engine/test/baseEventBlock";

export function createEngineTestHarness (options: Object, ...commandBlocks: any) {
  return createProphetTestHarness({
    name: "Engine Test Harness", ContentAPI: EngineTestAPI, TestHarness: EngineTestHarness,
    corpusOptions: { builtinSteppers },
    ...options,
  }, ...(options.claimBaseBlock ? [baseEventBlock] : []), ...commandBlocks);
}

export async function createEngineOracleHarness (options: Object, ...commandBlocks: any) {
  return createProphetOracleHarness({
    name: "Engine Oracle Harness", ContentAPI: EngineTestAPI, TestHarness: EngineTestHarness,
    corpusOptions: { builtinSteppers },
    ...options,
  }, ...(options.claimBaseBlock ? [baseEventBlock] : []), ...commandBlocks);
}

export default class EngineTestHarness extends ProphetTestHarness {
  constructor (options: Object) {
    super(options);
    this.engine = new ValaaEngine({
      name: "Test ValaaEngine",
      logger: this.getLogger(),
      prophet: this.prophet,
      verbosity: this.getVerbosity(),
    });

    const rootScope = this.engine.getRootScope();
    extendValaaSpace(rootScope, this.engine.getHostObjectDescriptors(), this.schema);
    // TODOO(iridian): This should be in @valos/inspire, but there is no such thing.
    rootScope.Valaa.InspireGateway = {
      RemoteAuthorityURI: "valaa-testing:",
      LocalAuthorityURI: "valaa-local:",
    };

    this.createds = new TestCollectCREATEDCog();
    this.engine.addCog(this.createds);
    this.entities = this.createds.Entity;
  }
}

export class TestCollectCREATEDCog extends Cog {
  constructor () {
    super({ name: "Test Collect CREATED's Cog" });
    this.TestScriptyThing = {};
  }

  onEventCREATED (vResource: Vrapper) {
    (this[vResource.getTypeName()] || (this[vResource.getTypeName()] = {}))[vResource.getRawId()]
        = vResource;
  }
}
