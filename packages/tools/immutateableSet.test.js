const { createImmutateableSet } = require("./immutateableSet");

const _timings = {};

let _previousTiming;

function _initTiming () {
  _previousTiming = performance.now();
}

function _addTiming (name, iterations, options) {
  const duration = performance.now() - _previousTiming;
  const timing = _timings[name] || (_timings[name] = { total: 0, count: 0 });
  timing.total += duration;
  timing.count += (iterations || 1);
  console.log(name,
      "duration:", duration, "total:", timing.total,
      "iterations:", timing.count,
      "\n\taverage:", timing.total / timing.count * 1000000,
      ...(options ? ["\n\toptions:", options] : []),
  );
  _previousTiming = performance.now();
}

jest.setTimeout(30000);

const baselen = 10 ** 5;

const repeatFactor = 10 ** 1;

const createRepeats = (10 ** 0) * repeatFactor;
const accessRepeats = (10 ** 1) * repeatFactor;
const deepRepeats = (10 ** 0) * repeatFactor;
const deepAccessRepeats = (10 ** 2) * repeatFactor;

const shallowCount = 10 ** 4;
const deepCount = 10 ** 1;
const maxDepth = 10 ** 2;

const onames = Array((baselen + shallowCount + createRepeats) * 10).fill(0)
    .map((v, i) => `n${String(i)}`);

it("array timings", async () => {
  _initTiming();

  const base = Array(baselen);
  _addTiming("\n\narray base alloc", baselen);

  for (let r = createRepeats; r-- > 0;) {
    for (let i = 0; i < baselen; ++i) {
      base[i] = baselen + r - i;
    }
  }
  _addTiming("array base init", baselen * createRepeats);

  for (let r = createRepeats; r-- > 0;) {
    for (let j = 0; j < baselen; ++j) {
      const value = base[j];
      if (value !== baselen - j) {
        throw new Error(`access failure: base[${j}] equals ${value}, ${baselen - j} expected`);
      }
    }
  }
  _addTiming("array base accesses", baselen * createRepeats);

  const shallows = Array(shallowCount);
  for (let r = createRepeats; r-- > 0;) {
    for (let j = 0; j < shallowCount; ++j) {
      shallows[j] = Object.create(base);
      shallows[j][j] = j + r;
      shallows[j][baselen + j] = j + r;
    }
  }
  _addTiming("array shallow deriveds", shallowCount * createRepeats);

  for (let r = accessRepeats; r-- > 0;) {
    for (let j = 0; j < shallowCount; ++j) {
      const value = shallows[j][j];
      if (value !== j) {
        throw new Error(`access failure: shallows[${j}][${j}] equals ${value}, ${j} expected`);
      }
    }
  }
  _addTiming("array shallow accesses", shallowCount * accessRepeats);

  const deeps = Array(deepCount);
  for (let r = deepRepeats; r-- > 0;) {
    for (let j = 0; j < deepCount; ++j) {
      let cur = shallows[j];
      for (let d = 0; d < maxDepth; ++d) {
        cur = Object.create(cur);
        cur[deepCount + j + d] = -d;
      }
      deeps[j] = cur;
    }
  }
  _addTiming("array deep deriveds", deepCount * maxDepth * deepRepeats);

  for (let r = deepAccessRepeats; r-- > 0;) {
    for (let j = 0; j < deepCount; ++j) {
      const value = deeps[j][deepCount + j + maxDepth - 1];
      if (value !== 1 - maxDepth) {
        throw new Error(`access failure: deeps[${j}][${deepCount + j + maxDepth - 1}] equals ${
            value}, ${1 - maxDepth} expected`);
      }
    }
  }
  _addTiming("array deep shallow accesses", deepCount * deepAccessRepeats);

  for (let r = deepAccessRepeats; r-- > 0;) {
    for (let j = 0; j < deepCount; ++j) {
      const value = deeps[j][deepCount + j + 1];
      if (value !== -1) {
        throw new Error(
            `access failure: deeps[${j}][${deepCount + j + 1}] equals ${value}, -1 expected`);
      }
    }
  }
  _addTiming("array deep deep accesses", deepCount * deepAccessRepeats);

  for (let r = accessRepeats; r-- > 0;) {
    for (let j = 0; j < shallowCount; ++j) {
      const value = shallows[j][j];
      if (value !== j) {
        throw new Error(`access failure: shallows[${j}][${j}] equals ${value}, ${j} expected`);
      }
    }
  }
  _addTiming("array shallow accesses again", shallowCount * accessRepeats);
});

it("object timings", async () => {
  _initTiming();

  const obase = {};
  _addTiming("\n\nobject base alloc", baselen);

  for (let r = createRepeats; r-- > 0;) {
    for (let i = 0; i < baselen; ++i) {
      obase[onames[i]] = baselen + r - i;
    }
  }
  _addTiming("object base init", baselen * createRepeats);

  for (let r = createRepeats; r-- > 0;) {
    for (let j = 0; j < baselen; ++j) {
      const value = obase[onames[j]];
      if (value !== baselen - j) {
        throw new Error(`access failure: obase["${j}"] equals ${value}, expected ${baselen - j}`);
      }
    }
  }
  _addTiming("object base accesses", baselen * createRepeats);

  const oshallows = Array(shallowCount);
  for (let r = createRepeats; r-- > 0;) {
    for (let j = 0; j < shallowCount; ++j) {
      oshallows[j] = Object.create(obase);
      oshallows[j][onames[j]] = j + r;
      oshallows[j][onames[baselen + j]] = j + r;
    }
  }
  _addTiming("object shallow deriveds", shallowCount * createRepeats);

  for (let r = accessRepeats; r-- > 0;) {
    for (let j = 0; j < shallowCount; ++j) {
      const value = oshallows[j][onames[j]];
      if (value !== j) {
        throw new Error(`access failure: oshallows[${j}]["${j}"] equals ${value}, expected ${j}`);
      }
    }
  }
  _addTiming("object shallow accesses", shallowCount * accessRepeats);

  const odeeps = Array(deepCount);
  for (let r = deepRepeats; r-- > 0;) {
    for (let j = 0; j < deepCount; ++j) {
      let cur = oshallows[j];
      for (let d = 0; d < maxDepth; ++d) {
        cur = Object.create(cur);
        cur[onames[deepCount + j + d]] = -d;
      }
      odeeps[j] = cur;
    }
  }
  _addTiming("object deep deriveds", deepCount * maxDepth * deepRepeats);

  for (let r = deepAccessRepeats; r-- > 0;) {
    for (let j = 0; j < deepCount; ++j) {
      const value = odeeps[j][onames[deepCount + j + maxDepth - 1]];
      if (value !== 1 - maxDepth) {
        throw new Error(`access failure: odeeps[${j}]["${deepCount + j + maxDepth - 1}"] equals ${
            value}, expected ${1 - maxDepth}`);
      }
    }
  }
  _addTiming("object deep shallow accesses", deepCount * deepAccessRepeats);

  for (let r = deepAccessRepeats; r-- > 0;) {
    for (let j = 0; j < deepCount; ++j) {
      const value = odeeps[j][onames[deepCount + j + 1]];
      if (value !== -1) {
        throw new Error(
            `access failure: odeeps[${j}]["${deepCount + j + 1}"] equals ${value}, expected -1`);
      }
    }
  }
  _addTiming("object deep deep accesses", deepCount * deepAccessRepeats);

  for (let r = accessRepeats; r-- > 0;) {
    for (let j = 0; j < shallowCount; ++j) {
      const value = oshallows[j][onames[j]];
      if (value !== j) {
        throw new Error(`access failure: oshallows[${j}]["${j}"] equals ${value}, expected ${j}`);
      }
    }
  }
  _addTiming("object shallow accesses again", shallowCount * accessRepeats);
});

it("immutateable set timings", async () => {
  _initTiming();
  let immbase;
  for (let r = createRepeats; r-- > 0;) {
    immbase = createImmutateableSet();
    for (let i = 0; i < baselen; ++i) immbase.add(onames[baselen + r - i]);
  }
  _addTiming("\n\nsetarray base init", baselen * createRepeats);

  for (let r = accessRepeats; r-- > 0;) {
    let j = 0;
    for (const value of immbase) {
      if (value !== onames[baselen - j]) {
        throw new Error(`access failure: immbase entry #${j} equals ${value}, expected ${
            onames[baselen - j]}`);
      }
      ++j;
    }
  }
  _addTiming("setarray base accesses", baselen * accessRepeats);

  const immshallows = Array(shallowCount);
  for (let r = 1; r-- > 0;) {
    for (let j = 0; j < shallowCount; ++j) {
      const subimm = immshallows[j] = createImmutateableSet(immbase);
      const mutatee = onames[baselen - j];
      const successor = subimm.successor(mutatee);
      if (!successor && (j + 1 < shallowCount)) {
        throw new Error(`No successor found for mutatee: "${mutatee}"`);
      }
      subimm.delete(mutatee);
      subimm.add(onames[baselen + j + r], successor);
      subimm.add(mutatee);
    }
  }
  _addTiming("setarray shallow deriveds", shallowCount * createRepeats);

  for (let r = accessRepeats; r-- > 0;) {
    for (let j = 0; j < shallowCount; ++j) {
      const predecessor = immshallows[j].predecessor(onames[baselen - j - 1]);
      if (predecessor !== onames[baselen + j]
          && (predecessor !== undefined || (j + 1 < shallowCount))) {
        throw new Error(`access failure: immshallows[${j}].predecessor("${onames[j + 1]}") equals ${
            predecessor}, expected "${onames[baselen + j]}"`);
      }
    }
  }
  _addTiming("setarray shallow accesses", shallowCount * accessRepeats);

  const immdeeps = Array(deepCount);
  for (let r = deepRepeats; r-- > 0;) {
    for (let j = 0; j < deepCount; ++j) {
      let cur = immshallows[j];
      for (let d = 0; d < maxDepth; ++d) {
        cur = createImmutateableSet(cur);
        const mutatee = onames[deepCount + j + d];
        const successor = cur.successor(mutatee);
        if (!successor) throw new Error(`No successor found for mutatee: "${mutatee}"`);
        cur.delete(mutatee);
        cur.add(onames[baselen + j + d], successor);
        cur.add(mutatee);
      }
      immdeeps[j] = cur;
    }
  }
  _addTiming("setarray deep deriveds", deepCount * maxDepth * deepRepeats);

  for (let r = deepAccessRepeats; r-- > 0;) {
    for (let j = 0; j < deepCount; ++j) {
      const predecessor = immdeeps[j].predecessor(onames[deepCount + j + maxDepth - 1]);
      if (predecessor !== onames[deepCount + j + maxDepth - 2]) {
        throw new Error(`access failure: immdeeps[${j}].predecessor("${
            onames[deepCount + j + maxDepth - 1]}") equals ${
            predecessor}, expected "${onames[deepCount + j + maxDepth - 2]}"`);
      }
    }
  }
  _addTiming("setarray deep shallow accesses", deepCount * deepAccessRepeats);

  for (let r = deepAccessRepeats; r-- > 0;) {
    for (let j = 0; j < deepCount; ++j) {
      const value = immdeeps[j].predecessor(onames[baselen - deepCount - 1]);
      if (value !== onames[baselen - deepCount]) {
        throw new Error(`access failure: immdeeps[${j}].predecessor("${
            onames[baselen - deepCount - 1]}") equals ${value}, expected "${
            onames[baselen - deepCount]}"`);
      }
    }
  }
  _addTiming("setarray deep deep accesses", deepCount * deepAccessRepeats);

  // await new Promise(r => setTimeout(r, 10 ** 4));
  console.log("done");
});
