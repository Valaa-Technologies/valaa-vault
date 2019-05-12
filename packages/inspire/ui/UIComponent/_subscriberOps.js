// @flow

import Vrapper from "~/engine/Vrapper";

import { invariantify } from "~/tools";

import UIComponent from "./UIComponent";

export function _initiateSubscriptions (component: UIComponent, focus: any, props: Object) {
  if (!component || component._areSubscriptionsBound) return;
  component.bindFocusSubscriptions(focus, props);
  invariantify(component._areSubscriptionsBound, `${component.constructor.name
      }().super.bindFocusSubscriptions not called from derived bindFocusSubscriptions`);
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

export function _bindLiveKuery (component: UIComponent, bindingSlot: string,
  head: any, kuery: any, options: Object,
) {
  component.unbindSubscription(bindingSlot, { require: false });
  if (head === undefined) return undefined;
  const engine = component.context.engine;
  if (!options.onUpdate && !options.asRepeathenable) {
    throw new Error("bindLiveKuery.options must specify either onUpdate or asRepeathenable");
  }
  const subscription = (head instanceof Vrapper ? head : engine)
      .obtainSubscription(
          kuery, options, engine.getActiveGlobalOrNewLocalEventGroupTransaction, head);
  component._subscriptions[bindingSlot] = subscription;
  return subscription.addListenerCallback(component, bindingSlot,
      options.onUpdate, options.updateImmediately, options.asRepeathenable);
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
    console.warn("UIComponent.unbindSubscription, no subscription in slot", bindingSlot);
  }
}

function _removeSubscriptions (component: UIComponent, subscriptions: Object, slot: string) {
  if (!subscriptions) return;
  if (!Array.isArray(subscriptions)) subscriptions.removeListenerCallback(component, slot);
  else {
    subscriptions.forEach(subscription => subscription.removeListenerCallback(component, slot));
  }
}
