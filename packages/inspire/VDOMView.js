// @flow

import React from "react";
import ReactDOM from "react-dom";

import Cog from "~/engine/Cog";

import ReactRoot from "~/inspire/ui/ReactRoot";

import { dumpObject } from "~/tools";

/**
 * This class is the view entry point
 */
export default class VDOMView extends Cog {
  constructor (options = {}) {
    super(options.parent, options.verbosity, options.name);
  }

  getGateway () { return this._parent; }
  getFocus () { return this._vFocus; }
  getViewConfig () { return this._viewConfig; }

  getEngine () { return this._engine; }
  setEngine (engine: Object) { this._engine = engine; }

  getRootScope () { return this._rootScope; }
  setRootScope (rootScope: Object) { this._rootScope = rootScope; }

  getHTML () {
    return this._rootElement.innerHTML;
  }

  getOuterHTML () {
    return this._rootElement.outerHTML;
  }

  getVRef () {
    return this._vFocus.getVRef();
  }

  run (head: any, kuery: Object, options: Object) {
    return this._vFocus.run(head, kuery, options);
  }

  async attach (container: Object, viewConfig: Object) {
    try {
      const rootProps = await this._setupViewRootProps(viewConfig);
      this._vFocus = rootProps.focus;
      this._viewConfig = viewConfig;
      this.getEngine().addCog(this);
      await this._createReactRoot(container, viewConfig.viewRootId, {
        viewName: viewConfig.name,
        contextLensProperty: [].concat(viewConfig.contextLensProperty || ["LENS"]),
        isFullscreen: viewConfig.isFullscreen,
        rootProps,
      });
      return this;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `attach('${viewConfig.name}' -> ${viewConfig.focus})`);
    }
  }

  async detach () {
    await this._destroy();
    // TODO(iridian, 2020-02): release all other resources as well.
  }

  async createJob (jobStack = {}) {
    const { delay, repeats, interval, journal } = jobStack;
    const plog1 = this.opLog(1, "job", "Creating job");
    if (typeof delay === "number") {
      plog1 && plog1.opEvent("delay",
          `Delaying job setup for ${delay} seconds`);
      await new Promise(resolve => setTimeout(resolve, Math.abs(delay * 1000)));
    }
    const _getJobProduct = (product = jobStack.product) => product;
    if (!repeats) {
      plog1 && plog1.opEvent("run_singular",
          "Running a singular job");
      if (journal) journal.mode = "singular";
      return _getJobProduct(await jobStack.performTask(0));
    }
    if (typeof interval !== "number") {
      throw new Error("runJob.options.interval must be a number (in seconds)");
    }
    plog1 && plog1.opEvent("setup_repeats",
        `Setting up a ${typeof repeats === "number" ? repeats : "infinite"
            } repeats job every ${interval} seconds`);
    if (journal) journal.mode = `repeats`;
    let beat = 0;
    return new Promise((resolve, reject) => {
      const _runTask = async () => {
        const currentBeat = beat++;
        try {
          const taskResult = await jobStack.performTask(currentBeat);
          if (!repeater ||
              (repeats
                  && (taskResult === undefined)
                  && ((typeof repeats !== "number") || (beat < repeats)))) return;
          resolve(_getJobProduct(taskResult));
        } catch (error) {
          const wrapped = this.wrapErrorEvent(error,
              new Error(`createJob.interval(beat: ${currentBeat})`),
              "\n\tjournal:", ...dumpObject(journal));
          if (!repeater) {
            this.outputErrorEvent(wrapped, 1,
                "Exception caught from a task after its job repeater was already settled");
            return;
          }
          reject(wrapped);
        }
        clearInterval(repeater);
        repeater = null;
      };
      let repeater = setInterval(_runTask, interval * 1000);
      _runTask();
    });
  }

  async _setupViewRootProps ({ focus, lensURI, rootLensURI, lens, lensProperty }) {
    if (lensURI) this.debugEvent("DEPRECATED: options.lensURI in favor of options.focus");
    if (rootLensURI) this.debugEvent("DEPRECATED: options.rootLensURI in favor of options.focus");
    const actualFocus = focus
        || lensURI
        || rootLensURI
        || this.getGateway().getRootFocusURI();
    const { reference: focusRef, vResource: vFocus } =
        await this.getEngine().activateResource(actualFocus);
    // Load project
    const ret = {
      focus: vFocus,
      lensProperty: [].concat(
          (focusRef && focusRef.getQueryComponent().lens)
              || lensProperty
              || ["ROOT_LENS", "LENS"]),
    };
    if (lens !== undefined) {
      ret.lens = lens.includes("://")
          ? (await this.getEngine().activateResource(lens)).vResource
          : lens;
    }
    this.warnEvent(1, () => [
      `preAttach(): view '${vFocus && vFocus.step("name")}' focus set:`, vFocus && vFocus.debugId(),
    ]);
    return ret;
  }

 /**
  * Creates the root UI component with the react context, and connects it to the html container.
  */
  async _createReactRoot (container: Object, viewRootId: string, reactRootProps) {
    if (!viewRootId) throw new Error("createReactRoot: viewRootId missing");
    this._rootElement = container.ownerDocument.createElement("div");
    this._rootElement.setAttribute("id", viewRootId);
    container.appendChild(this._rootElement);
    this._reactRoot = (<ReactRoot {...reactRootProps} />);
    return new Promise(onDone => {
      ReactDOM.render(this._reactRoot, this._rootElement, onDone);
    });
  }

  _destroy () {
    // This is not called from anywhere as it is
    ReactDOM.unmountComponentAtNode(this._rootElement);
  }
}
