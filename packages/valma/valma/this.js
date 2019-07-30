exports.command = ".";
exports.describe = "Access valma runtime context property or call a method";
exports.introduction =
`This command is a shim to valma script context singleton API object 'vlm'.`;

exports.builder = (yargs) => yargs;

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const topArgs = [".", ...yargv._.slice(0, (yargv._.indexOf("--") + 1) || undefined)];
  const ret_ = (await _walk(vlm, topArgs)).value;
  vlm.ifVerbose(1)
      .info("this.ret:", ret_);
  return ret_;

  async function _walk (head, argv, index = 0, isArgument) {
    vlm.ifVerbose(1)
        .info("walk:", isArgument, argv.slice(index));
    let ret;
    try {
      if (index >= argv.length) return (ret = { value: head });
      switch (argv[index]) {
        case ".": {
          const property = argv[index + 1];
          if (typeof property !== "string" && typeof property !== "number") {
            throw new Error(`expected an identifier or index after '.', got ${typeof property}`);
          }
          const { subHead, subProperty } = await _subWalk(head, property.split("."));
          let nextHead = subHead[subProperty];
          let nextIndex = index + 2;
          if (typeof nextHead === "function") {
            const args = await _getArgs(argv, nextIndex);
            nextHead = await nextHead.apply(subHead, args.value);
            nextIndex = args.index;
          }
          return (ret = await _walk(nextHead, argv, nextIndex));
        }
        case "&&":
        case "||": {
          const truthy = (typeof head === "string" ? !head : head);
          if (argv[index] === "&&" ? !truthy : truthy) {
            return (ret = { value: head, index: undefined });
          }
          return (ret = await _walk(vlm, argv, index + 1));
        }
        case "(": {
          let depth = 1;
          let i = index + 1;
          for (; (i < argv.length) && depth; ++i) {
            if (argv[i] === "(") ++depth;
            if (argv[i] === ")") --depth;
          }
          if (depth) throw new Error("unmatched '('");
          const result = await _walk(vlm, argv.slice(index + 1, i - 1));
          return (ret = await _walk(result.value, argv, i));
        }
        case ")": throw new Error("mismatching ')'");
        default: {
          if (isArgument) {
            const arg = argv[index];
            const value = !(arg[0] === "{" || arg[0] === "[") ? arg : JSON.parse(arg);
            return { value, index: index + 1 };
          }
          const args = await _getArgs(argv, index + 1);
          const result = await vlm.execute([argv[index], ...args.value],
              { onSuccess: true, onFailure: false });
          return (ret = await _walk(result, argv, args.index));
        }
      }
    } finally {
      vlm.ifVerbose(1)
          .info("  walk.ret:", argv.slice(index), ret && ret.index, ":", ret && ret.value);
    }
  }

  async function _subWalk (head, properties, index = 0) {
    const subHead = await head;
    if (index + 1 >= properties.length) return { subHead, subProperty: properties[index] };
    return _subWalk(subHead[properties[index]], properties, index + 1);
  }

  async function _getArgs (argv, index) {
    const value = [];
    let i = index;
    const argTerminators = { ".": true, "&&": true, "||": true, ")": true };
    while (i < argv.length && !argTerminators[argv[i]]) {
      const result = (await _walk(vlm, argv, i, true));
      i = result.index;
      value.push(result.value);
    }
    return { value, index: i };
  }
};
