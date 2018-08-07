// @flow

import { Iterable } from "immutable";
import { vdocorate, toVDoc } from "~/tools/vdoc";

export const HostRef = Symbol("HostRef");
export const PackedHostValue = Symbol("PackedHostValue");
export const UnpackedHostValue = Symbol("UnpackedHostValue");

export const vdoc = toVDoc({ "...": { heading:
  "Host References point to external resources",
},
  0: [
    `VALK and Valker treat _host references_ as opaque data.
    There are three symbols that VALK recognizes: _HostRef_,
    _PackedValue_ and _UnpackedHostValueTag_.`,
    `Host references come in different forms depending on function but
    they all define the _HostRef_ property. This property contains the
    canonical host reference object ({link @ValaaReference} by
    default).`,
    `Packed host references always define _PackedValue_ which contains
    implementation defined data.`,
    `Unpacked host references define _UnpackedHostValue_ which contains
    data specific to the current Valker implementation.`,
  ],
});

export const tryHostRef = vdocorate([
  `Returns a host reference object if _value_ is a valid host value.`,
  `@export`,
  `@param {*} value`,
  `@returns`,
])(function tryHostRef (value: any): any {
  if (value != null) {
    const ret = value[HostRef];
    if (ret !== undefined) return (ret === null) ? value : ret;
    if (Iterable.isKeyed(value)) return value.get("id");
  }
  return undefined;
});

export const tryPackedHostValue = vdocorate([
  `Returns the packed value if _value_ is a packed and valid host
  value.`,
  `@export`,
  `@param {*} value`,
  `@returns`,
])(function tryPackedHostValue (value: any): any {
  if (value != null) {
    const ret = value[PackedHostValue];
    if (ret !== undefined) return (ret === null) ? value : ret;
    if (Iterable.isKeyed(value)) return value;
  }
  return undefined;
});

export const tryUnpackedHostValue = vdocorate([
  `Returns the unpacked value if _value_ is an unpacked and valid host
  value.`,
  `@export`,
  `@param {*} value`,
  `@returns`,
])(function tryUnpackedHostValue (value: any): any {
  if (value != null) {
    const ret = value[UnpackedHostValue];
    if (ret !== undefined) return (ret === null) ? value : ret;
  }
  return undefined;
});

export const isHostRef = vdocorate([
  `Returns true if _value_ is a valid host value.`,
  `@export`,
  `@param {*} value`,
  `@returns`,
])(function isHostRef (value: any): boolean {
  return (value != null) && ((value[HostRef] !== undefined) || Iterable.isKeyed(value));
});

export const isPackedHostValue = vdocorate([
  `Returns true if _value_ is a packed and valid host value.`,
  `@export`,
  `@param {*} value`,
  `@returns`,
])(function isPackedHostValue (value: any): boolean {
  return (value != null) && ((value[PackedHostValue] !== undefined) || Iterable.isKeyed(value));
});

export const isUnpackedHostValue = vdocorate([
  `Returns true if _value_ is an unpacked valid host value.`,
  `@export`,
  `@param {*} value`,
  `@returns`,
])(function isUnpackedHostValue (value: any): boolean {
  return (value != null) && (value[UnpackedHostValue] !== undefined);
});
