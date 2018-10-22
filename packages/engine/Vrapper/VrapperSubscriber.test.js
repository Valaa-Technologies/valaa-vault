// @flow

import { created } from "~/raem/command";

import VALEK, { Kuery, pointer, literal } from "~/engine/VALEK";
import Vrapper, { VrapperSubscriber } from "~/engine/Vrapper";

import { createEngineTestHarness } from "~/engine/test/EngineTestHarness";

function idOf (candidate: any) {
  if ((candidate === null) || (candidate === undefined)) return undefined;
  if (!(candidate instanceof Vrapper)) {
    throw new Error(`Expected Vrapper, got ${
        ((typeof candidate === "object") && candidate.constructor.name) || typeof candidate}`);
  }
  return candidate.getId();
}

describe("VrapperSubscriber", () => {
  let harness: { createds: Object, engine: Object, prophet: Object, testEntities: Object };
  const entities = () => harness.createds.Entity;
  const properties = () => harness.createds.Property;

  let liveCallback;
  let subscriber;

  function setUpHarnessAndCallback (options: Object, ...proclamationBlocks: any) {
    harness = createEngineTestHarness(options, ...proclamationBlocks);
    liveCallback = jest.fn(); // eslint-disable-line
  }

  function setUpKueryTestHarness (kuery: Kuery, subscriberName: string, options: Object) {
    setUpHarnessAndCallback(options);
    subscriber = new VrapperSubscriber().setSubscriberInfo(subscriberName, harness);
    entities().creator.subscribeToMODIFIED(kuery, liveCallback, subscriber, options);
    subscriber.triggerUpdate();
  }

  function setUpPropertyTargetTestHarness (propertyName: string, options: Object) {
    setUpKueryTestHarness(VALEK.propertyTarget(propertyName, { optional: true }),
        "VALEK.propertyTarget subscriber", options);
  }

  describe("Live kuery VALEK.propertyTarget subscribeToMODIFIED callback calls", () => {
    it("is called with triggerUpdate", () => {
      setUpPropertyTargetTestHarness("template", { debug: 0, claimBaseBlock: true });
      expect(liveCallback.mock.calls.length).toBe(1);
      expect(idOf(liveCallback.mock.calls[0][0].value()))
          .toBe(idOf(entities().ownling_prototype));
    });

    it("is called on first step content change: matching addition on filtered array", () => {
      setUpPropertyTargetTestHarness("template_matching", { debug: 0, claimBaseBlock: true });
      expect(liveCallback.mock.calls.length).toBe(1);
      expect(idOf(liveCallback.mock.calls[0][0].value()))
          .toBe(undefined);
      entities().creator.emplaceAddToField("properties", {
        name: "template_matching", value: pointer(entities().ownling),
      });
      expect(liveCallback.mock.calls.length).toBe(2);
      expect(idOf(liveCallback.mock.calls[1][0].value()))
          .toBe(idOf(entities().ownling));
    });

    it("is called on first step content change: matching removal on filtered array", () => {
      setUpPropertyTargetTestHarness("template", { debug: 0, claimBaseBlock: true });
      properties()["creator.prototype"].destroy();
      expect(liveCallback.mock.calls.length).toBe(2);
      expect(idOf(liveCallback.mock.calls[1][0].value()))
          .toBe(undefined);
    });

    it("is called on intermediate step content change: name changed out to non-matching", () => {
      // subscribing to updates on properties used in filters which land on the active object path
      // is not implemented even though it is computationally trivial
      setUpPropertyTargetTestHarness("template", { debug: 0, claimBaseBlock: true });
      expect(liveCallback.mock.calls.length).toBe(1);
      properties()["creator.prototype"].setField("name", "template_nonmatching");
      expect(liveCallback.mock.calls.length).toBe(2);
      expect(idOf(liveCallback.mock.calls[1][0].value()))
          .toBe(undefined);
    });

    it("is called on intermediate step content change: name changed in to matching", () => {
      // TODO(iridian): Perf issue, although this test works (!).
      // Subscribing to updates on filter-properties outside active object path is computationally
      // non-trivial. Right now the implementation implicitly subscribes to 'name' on all property
      // candidates as well, not just the one with a matching name.
      setUpPropertyTargetTestHarness("template_matching", { debug: 0, claimBaseBlock: true });
      expect(liveCallback.mock.calls.length).toBe(1);
      properties()["creator.prototype"].setField("name", "template_matching");
      expect(liveCallback.mock.calls.length).toBe(2);
      expect(idOf(liveCallback.mock.calls[1][0].value()))
          .toBe(idOf(entities().ownling_prototype));
    });

    it("is called on the last step content change: property value is set to a new pointer", () => {
      setUpPropertyTargetTestHarness("template", { debug: 0, claimBaseBlock: true });
      properties()["creator.prototype"].setField("value", pointer(entities().ownling));
      expect(liveCallback.mock.calls.length).toBe(2);
      expect(idOf(liveCallback.mock.calls[1][0].value()))
          .toBe(idOf(entities().ownling));
    });

    it("properly refreshes subscribers on structural updates", () => {
      setUpPropertyTargetTestHarness("template_matching", { debug: 0, claimBaseBlock: true });
      expect(liveCallback.mock.calls.length).toBe(1);

      properties()["creator.prototype"].setField("value", pointer(entities().test));
      expect(liveCallback.mock.calls.length).toBe(1);

      properties()["creator.prototype"].setField("name", "template_matching");
      expect(liveCallback.mock.calls.length).toBe(2);
      expect(idOf(liveCallback.mock.calls[1][0].value()))
          .toBe(idOf(entities().test));

      properties()["creator.prototype"].setField("value", pointer(entities().ownling));
      expect(liveCallback.mock.calls.length).toBe(3);
      expect(idOf(liveCallback.mock.calls[2][0].value()))
          .toBe(idOf(entities().ownling));
    });

    it("properly deregisters subscribers on structural updates", () => {
      setUpPropertyTargetTestHarness("template", { debug: 0, claimBaseBlock: true });
      expect(liveCallback.mock.calls.length).toBe(1);

      properties()["creator.prototype"].setField("value", pointer(entities().test));
      expect(liveCallback.mock.calls.length).toBe(2);
      expect(idOf(liveCallback.mock.calls[1][0].value()))
          .toBe(idOf(entities().test));

      properties()["creator.prototype"].setField("name", "template_nonmatching");
      expect(liveCallback.mock.calls.length).toBe(3);
      expect(liveCallback.mock.calls[2][0].value())
          .toBe(undefined);

      properties()["creator.prototype"].setField("value", pointer(entities().ownling));
      expect(liveCallback.mock.calls.length).toBe(3);
    });
  });

  describe("Live kuery VALEK.propertyTarget.propertyValue callback calls", () => {
    function setUpPropertyTargetValueTestHarness (propertyName: string, valueName: string,
        options: Object) {
      setUpKueryTestHarness(
          VALEK.propertyTarget(propertyName, { optional: true }).propertyValue(valueName),
          "VALEK.propertyTarget.propertyValue",
          options);
    }

    it("property refreshes subscribers to updated property itself", () => {
      setUpPropertyTargetValueTestHarness("pointer_to_ownling", "ownling_counter",
          { debug: 0, claimBaseBlock: true });
      expect(liveCallback.mock.calls.length).toBe(1);
      expect(liveCallback.mock.calls[0][0].value()).toEqual(10);

      properties()["ownling.counter"].setField("value", literal(1));

      expect(liveCallback.mock.calls.length).toBe(2);
      expect(liveCallback.mock.calls[1][0].value()).toEqual(1);
    });

    it("kuery expression property refreshes subscribers on updates to a depended property", () => {
      setUpPropertyTargetValueTestHarness("pointer_to_ownling", "ownling_counter_plus_seven",
          { debug: 0, claimBaseBlock: true });
      expect(liveCallback.mock.calls.length).toBe(1);
      expect(liveCallback.mock.calls[0][0].value()).toEqual(17);

      properties()["ownling.counter"].setField("value", literal(1));

      expect(liveCallback.mock.calls.length).toBe(2);
      expect(liveCallback.mock.calls[1][0].value()).toEqual(8);
    });
  });

  describe("Live VALK kueries", () => {
    it("updates on ghost-of-ghost-of-thing property when middle ghost property is modified", () => {
      setUpHarnessAndCallback({ debug: 0, claimBaseBlock: true }, [
        created({ id: "test#1#1", typeName: "Entity", initialState: {
          instancePrototype: "test#1",
        }, }),
      ]);
      const creatori1 = entities().creator.getGhostIn(entities()["test#1"]);
      const creatori1i1 = creatori1.getGhostIn(entities()["test#1#1"]);

      creatori1i1.get(VALEK.propertyValue("counter"), { onUpdate: liveCallback });

      expect(liveCallback.mock.calls.length).toBe(1);
      expect(liveCallback.mock.calls[0][0].value()).toEqual(0);

      entities().creator.alterProperty("counter", ["§'", 10]);

      expect(creatori1.propertyValue("counter")).toBe(10);
      expect(creatori1i1.propertyValue("counter")).toBe(10);
      expect(liveCallback.mock.calls.length).toBe(2);
      expect(liveCallback.mock.calls[1][0].value()).toEqual(10);

      creatori1.alterProperty("counter", ["§'", 20]);

      expect(creatori1.propertyValue("counter")).toBe(20);
      expect(creatori1i1.propertyValue("counter")).toBe(20);
      expect(liveCallback.mock.calls.length).toBe(3);
      expect(liveCallback.mock.calls[2][0].value()).toEqual(20);
    });
  });
});
