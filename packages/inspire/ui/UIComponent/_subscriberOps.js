// @flow

import Vrapper, { Subscription, LiveUpdate } from "~/engine/Vrapper";
import { Kuery } from "~/engine/VALEK";

import { invariantify, invariantifyObject, invariantifyFunction } from "~/tools";

import UIComponent from "./UIComponent";

export function _initiateSubscriptions (component: UIComponent, focus: any, props: Object) {
  if (!component || component._areSubscriptionsBound) return;
  component.bindSubscriptions(focus, props);
  invariantify(component._areSubscriptionsBound, `${component.constructor.name
      }().super.bindSubscriptions not called from derived bindSubscriptions`);
}

export function _finalizeUnbindSubscriptions (component: UIComponent, /* focus: ?Vrapper */) {
  component._areSubscriptionsBound = false;
  Object.entries(component._subscriptions).forEach(([bindingSlot, subscriptions]) =>
      _removeSubscriptions(component, subscriptions, bindingSlot));
  component._subscriptions = {};
}

export function _finalizeUnbindSubscribersExcept (component: UIComponent, exceptSlot: string) {
  component._areSubscriptionsBound = false;
  const newSubscriptions = { [exceptSlot]: component._subscriptions[exceptSlot] };
  Object.entries(component._subscriptions).forEach(([bindingSlot, subscriptions]) =>
      (bindingSlot !== exceptSlot) && _removeSubscriptions(component, subscriptions, bindingSlot));
  component._subscriptions = newSubscriptions;
}

export function _bindNewKuerySubscription (component: UIComponent, bindingSlot: string, head: any,
  kuery: any, options: { noImmediateRun?: boolean },
  onUpdate: (liveUpdate: LiveUpdate) => void,
) {
  let subscription;
  if (head === undefined) {
    component.unbindSubscription(bindingSlot, { require: false });
    return undefined;
  }
  const engine = component.context.engine;
  invariantifyFunction(onUpdate, "bindNewKuerySubscription_onUpdate");
  if ((typeof kuery === "object") && (kuery instanceof Kuery)) {
    options.liveSubscription = true;
    subscription = (head instanceof Vrapper ? head : engine)
        .run(head, kuery, options);
  } else {
    invariantifyObject(head, "bindNewKuerySubscription.head (when kuery is a filter)",
        { instanceof: Vrapper });
    subscription = head.obtainSubscription(kuery, options);
  }
  component.bindSubscription(bindingSlot, subscription, onUpdate,
      !options.noImmediateRun && engine.discourse.getState());
  return subscription;
}

export function _bindSubscription (component: UIComponent, bindingSlot: string,
    subscription: Subscription, onUpdate: Function, immediateUpdateState: ?Object) {
  if (!(subscription instanceof Subscription)) {
    throw new Error(
        "_bindSubscription.subscriber must be valid subscriber object (must have .triggerUpdate)");
  }
  component.unbindSubscription(bindingSlot, { require: false });
  component._subscriptions[bindingSlot] = subscription;
  subscription.addSubscriber(component, bindingSlot, onUpdate, immediateUpdateState);
  return subscription;
}

export function _getBoundSubscription (component: UIComponent, bindingSlot: string) {
  return component._subscriptions[bindingSlot];
}

export function _unbindSubscription (component: UIComponent, bindingSlot: string,
    options: { require?: boolean } = {}
) {
  const subscriptions = component._subscriptions[bindingSlot];
  if (subscriptions) {
    _removeSubscriptions(component, subscriptions, bindingSlot);
    component._subscriptions[bindingSlot] = undefined;
  } else if (options.require !== false) {
    console.warn("UIComponent.unbindSubscription, cannot find subscriber", bindingSlot);
  }
}

function _removeSubscriptions (component: UIComponent, subscriptions: Object, bindingSlot: string) {
  if (!subscriptions) return;
  if (!Array.isArray(subscriptions)) subscriptions.removeSubscriber(this, bindingSlot);
  else subscriptions.forEach(subscription => subscription.removeSubscriber(this, bindingSlot));
}
