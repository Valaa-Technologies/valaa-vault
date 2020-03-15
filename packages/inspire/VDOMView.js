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
  constructor (options) {
    super(options);
    this._gateway = options.gateway;
  }

  getGateway () { return this._gateway; }
  getFocus () { return this._vFocus; }
  getViewConfig () { return this._viewConfig; }

  getRootScope () { return this._rootScope; }
  setRootScope (rootScope: Object) { this._rootScope = rootScope; }

  getHTML () {
    return this._rootElement.innerHTML;
  }

  getOuterHTML () {
    return this._rootElement.outerHTML;
  }

  getSelfAsHead () {
    return this._vFocus.getSelfAsHead();
  }

  run (head: any, kuery: Object, options: Object) {
    return this._vFocus.run(head, kuery, options);
  }

  async attach (container: Object, viewConfig: Object) {
    try {
      const rootProps = await this._setupViewRootProps(viewConfig);
      this._vFocus = rootProps.focus;
      this._viewConfig = viewConfig;
      this.engine.addCog(this);
      await this._createReactRoot(container, viewConfig.viewRootId, {
        viewName: viewConfig.name,
        contextLensProperty: [].concat(viewConfig.contextLensProperty || ["LENS"]),
        isHTMLRoot: viewConfig.isHTMLRoot,
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
    if (typeof delay === "number") {
      this.clockEvent(1, "job.delay", `Delaying job setup for ${delay} seconds`);
      await new Promise(resolve => setTimeout(resolve, Math.abs(delay * 1000)));
    }
    const _getJobProduct = (product = jobStack.product) => product;
    if (!repeats) {
      this.clockEvent(1, "job.singular.run", "Running a singular job");
      if (journal) journal.mode = "singular";
      return _getJobProduct(await jobStack.performTask(0));
    }
    if (typeof interval !== "number") {
      throw new Error("runJob.options.interval must be a number (in seconds)");
    }
    this.clockEvent(1, "job.repeats.setup", `Setting up a ${
        typeof repeats === "number" ? repeats : "infinite"} repeats job every ${interval} seconds`);
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
    if (lensURI) this.warnEvent("options.lensURI DEPRECATED in favor of options.focus");
    if (rootLensURI) this.warnEvent("options.rootLensURI DEPRECATED in favor of options.focus");
    const actualFocus = focus || lensURI || rootLensURI;
    if (!actualFocus) throw new Error(`No options.focus found for view ${name}`);
    // Load project
    const { reference: focusRef, vResource: vFocus } =
        await this.engine.activateResource(actualFocus);
    const ret = {
      focus: vFocus,
      lensProperty: [].concat(
          focusRef.getQueryComponent().lens || lensProperty || ["ROOT_LENS", "LENS"]),
    };
    if (lens !== undefined) {
      ret.lens = lens.includes("://")
          ? (await this.engine.activateResource(lens)).vResource
          : lens;
    }
    this.warnEvent(1, () => [
      `preAttach(): view '${vFocus.get("name")}' focus set:`, ret.focus.debugId(),
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
