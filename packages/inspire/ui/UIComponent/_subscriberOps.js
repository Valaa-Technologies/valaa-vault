// @flow

import Vrapper, { VrapperSubscriber, FieldUpdate } from "~/engine/Vrapper";
import { Kuery } from "~/engine/VALEK";

import { invariantify, invariantifyObject, invariantifyFunction } from "~/tools";

import UIComponent from "./UIComponent";

export function _initiateAttachSubscribers (component: UIComponent, focus: any, props: Object) {
  if (component._areSubscribersAttached) return;
  component.attachSubscribers(focus, props);
  invariantify(component._areSubscribersAttached, `${component.constructor.name
      }().super.attachSubscribers not called from derived attachSubscribers`);
}

export function _finalizeDetachSubscribers (component: UIComponent, /* focus: ?Vrapper */) {
  component._areSubscribersAttached = false;
  Object.keys(component._attachedSubscribers).forEach(
      key => _unregisterSubscriberEntry(component, component._attachedSubscribers[key]));
  component._attachedSubscribers = {};
}

export function _finalizeDetachSubscribersExcept (component: UIComponent, exceptKey: string) {
  component._areSubscribersAttached = false;
  const newSubscribers = { [exceptKey]: component._attachedSubscribers[exceptKey] };
  Object.keys(component._attachedSubscribers).forEach(key => (key !== exceptKey)
      && _unregisterSubscriberEntry(component, component._attachedSubscribers[key]));
  component._attachedSubscribers = newSubscribers;
}

export function _attachSubscriber (component: UIComponent, subscriberKey: string,
    subscriber: VrapperSubscriber) {
  component.detachSubscriber(subscriberKey, { require: false });
  component._attachedSubscribers[subscriberKey] = subscriber;
  subscriber.setSubscriberInfo(subscriberKey, component);
  return subscriber;
}

export function _getSubscriber (component: UIComponent, subscriberKey: string) {
  return component._attachedSubscribers[subscriberKey];
}

export function _attachKuerySubscriber (component: UIComponent, subscriberName: string, head: any,
  kuery: any, options: { onUpdate: (update: FieldUpdate) => void, noImmediateRun?: boolean }
) {
  let subscriber;
  if (typeof head === "undefined") {
    component.detachSubscriber(subscriberName, { require: false });
    return undefined;
  }
  invariantifyFunction(options.onUpdate, "attachKuerySubscriber.options.onUpdate");
  if ((typeof kuery === "object") && (kuery instanceof Kuery)) {
    subscriber = (head instanceof Vrapper ? head : component.context.engine)
        .run(head, kuery, options);
  } else {
    invariantifyObject(head, "attachKuerySubscriber.head (when kuery is a filter)",
        { instanceof: Vrapper });
    subscriber = head.subscribeToMODIFIED(kuery, options.onUpdate);
    options.onUpdate = undefined;
    invariantify(subscriber.triggerUpdate,
        "subscriber from engine.run must be valid subscriber object (must have .triggerUpdate)");
    if (!options.noImmediateRun) subscriber.triggerUpdate(options);
  }
  component.attachSubscriber(subscriberName, subscriber);
  return subscriber;
}

export function _detachSubscriber (component: UIComponent, subscriberKey: string,
    options: { require?: boolean } = {}
) {
  const registeredFocusSubscriber = component._attachedSubscribers[subscriberKey];
  if (!registeredFocusSubscriber) {
    if (options.require !== false) {
      console.warn("UIComponent.detachSubscriber, cannot find subscriber", subscriberKey);
    }
    return;
  }
  _unregisterSubscriberEntry(component, registeredFocusSubscriber);
  delete component._attachedSubscribers[subscriberKey];
}

function _unregisterSubscriberEntry (component: UIComponent, entry: Object) {
  if (entry) {
    if (Array.isArray(entry)) entry.forEach(subscriber => subscriber.unregister());
    else entry.unregister();
  }
}
