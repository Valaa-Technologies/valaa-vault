// @flow

import { LogEventGenerator } from "~/tools";

const Fastify = require("fastify");

export default class RestAPIServer extends LogEventGenerator {
  constructor ({ view, viewName, gateway, port, address, routes, ...rest }) {
    super(rest);
    this._view = view;
    this._gateway = gateway;
    this._port = port;
    this._address = address;
    // https://github.com/fastify/fastify/blob/master/docs/Server.md
    this._fastify = Fastify({
      // ignoreTrailingSlash: false,
      // logger: true,
      // pluginTimeout: 10000,
      ...rest,
    });
    routes.forEach(route => this._addRoute(route));
  }

  start () {
    this._fastify.listen(this._port, this._address || undefined, (error) => {
      if (error) throw error;
      const port = this._fastify.server.address().port;
      this.logEvent(`ValOS REST API Server listening: ${port}`);
    });
  }

  _addRoute (route) {
    if (!route.handler) this._addRouteHandler(route);
    this._fastify.route(route);
  }

  _addRouteHandler (route) {
    route.handler = (request, reply) => reply.send(route.dummyReply);
  }
}
