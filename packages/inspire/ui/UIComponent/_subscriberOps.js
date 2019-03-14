// @flow

import Vrapper, { Subscription, FieldUpdate } from "~/engine/Vrapper";
import { Kuery } from "~/engine/VALEK";

import { invariantify, invariantifyObject, invariantifyFunction } from "~/tools";

import UIComponent from "./UIComponent";

export function _initiateSubscriptions (component: UIComponent, focus: any, props: Object) {
  if (!component || component._areSubscribersAttached) return;
  component.attachSubscribers(focus, props);
  invariantify(component._areSubscribersAttached, `${component.constructor.name
      }().super.attachSubscribers not called from derived attachSubscribers`);
}

export function _finalizeDetachSubscribers (component: UIComponent, /* focus: ?Vrapper */) {
  component._areSubscribersAttached = false;
  Object.keys(component._subscriptions).forEach(
      key => _unsubscribe(component, component._subscriptions[key]));
  component._subscriptions = {};
}

export function _finalizeDetachSubscribersExcept (component: UIComponent, exceptKey: string) {
  component._areSubscribersAttached = false;
  const newSubscriptions = { [exceptKey]: component._subscriptions[exceptKey] };
  Object.keys(component._subscriptions).forEach(key => (key !== exceptKey)
      && _unsubscribe(component, component._subscriptions[key]));
  component._subscriptions = newSubscriptions;
}

export function _attachSubscriber (component: UIComponent, subscriberKey: string,
    subscription: Subscription) {
  component.detachSubscriber(subscriberKey, { require: false });
  component._subscriptions[subscriberKey] = subscription;
  subscription.registerWithSubscriberInfo(subscriberKey, component);
  return subscription;
}

export function _getSubscriber (component: UIComponent, subscriberKey: string) {
  return component._subscriptions[subscriberKey];
}

export function _subscribeToKuery (component: UIComponent, subscriberName: string, head: any,
  kuery: any, options: { onUpdate: (update: FieldUpdate) => void, noImmediateRun?: boolean }
) {
  let subscription;
  if (head === undefined) {
    component.detachSubscriber(subscriberName, { require: false });
    return undefined;
  }
  invariantifyFunction(options.onUpdate, "subscribeToKuery.options.onUpdate");
  if ((typeof kuery === "object") && (kuery instanceof Kuery)) {
    subscription = (head instanceof Vrapper ? head : component.context.engine)
        .run(head, kuery, options);
  } else {
    invariantifyObject(head, "subscribeToKuery.head (when kuery is a filter)",
        { instanceof: Vrapper });
    subscription = head.subscribeToMODIFIED(kuery, options.onUpdate);
    options.onUpdate = undefined;
    invariantify(subscription.triggerUpdate,
        "subscriber from engine.run must be valid subscriber object (must have .triggerUpdate)");
    if (!options.noImmediateRun) subscription.triggerUpdate(options);
  }
  component.attachSubscriber(subscriberName, subscription);
  return subscription;
}

export function _unsubscribeKuery (component: UIComponent, subscriberKey: string,
    options: { require?: boolean } = {}
) {
  const registeredFocusSubscriber = component._subscriptions[subscriberKey];
  if (!registeredFocusSubscriber) {
    if (options.require !== false) {
      console.warn("UIComponent.detachSubscriber, cannot find subscriber", subscriberKey);
    }
    return;
  }
  _unsubscribe(component, registeredFocusSubscriber);
  delete component._subscriptions[subscriberKey];
}

function _unsubscribe (component: UIComponent, entry: Object) {
  if (entry) {
    if (Array.isArray(entry)) entry.forEach(subscriber => subscriber.unregister());
    else entry.unregister();
  }
}
