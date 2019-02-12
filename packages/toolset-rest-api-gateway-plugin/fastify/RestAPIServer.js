// @flow

import path from "path";

import { asyncConnectToPartitionsIfMissingAndRetry } from "~/raem/tools/denormalized/partitions";
import { dumpObject, LogEventGenerator, outputError } from "~/tools";
import VALEK from "~/engine/VALEK";

const Fastify = require("fastify");
const FastifySwaggerPlugin = require("fastify-swagger");

export default class RestAPIServer extends LogEventGenerator {
  constructor ({ view, viewName, port, address, prefix, schemas, routes, ...rest }) {
    super(rest);
    this._view = view;
    this._engine  = view.engine;
    this._gateway = view._gateway;
    this._port = port;
    this._address = address;
    this._prefix = prefix;
    // https://github.com/fastify/fastify/blob/master/docs/Server.md
    this._fastify = Fastify({
      // ignoreTrailingSlash: false,
      // logger: true,
      // pluginTimeout: 10000,
      ...rest,
    });
    schemas.forEach(schema => {
      this._fastify.addSchema(schema);
    });
    this._routes = routes;
  }

  async start () {
    this._routes = await Promise.all(this._routes.map(async rawRoute => {
      const route = { ...rawRoute };
      if (typeof route.handler !== "function") {
        route.handler = await this._createRouteHandler(route);
      }
      return route;
    }));
    this._fastify.register(this._fastifyMain, { prefix: this._prefix || "" });
    this._fastify.listen(this._port, this._address || undefined, (error) => {
      if (error) throw error;
      this.logEvent(`ValOS REST API Server listening @`, this._fastify.server.address());
    });
  }

  _fastifyMain = (fastify, opts, next) => {
    fastify.register(FastifySwaggerPlugin, {
      routePrefix: "/documentation",
      exposeRoute: true,
      swagger: {
        info: {
          title: "Treco Documentation Test swagger",
          description: "testing the fastify swagger api fro Treco",
          version: "0.1.0",
        },
        externalDocs: {
          url: "https://swagger.io",
          description: "Find more info here",
        },
        host: "0.0.0.0",
        schemes: ["http"],
        consumes: ["application/json"],
        produces: ["application/json"],
        tags: [
          { name: "user", description: "User related end-points" },
          { name: "code", description: "Code related end-points" },
        ],
        securityDefinitions: {
          apiKey: {
            type: "apiKey",
            name: "apiKey",
            in: "header",
          },
        },
      },
    });
    this._routes.map(route => fastify.route(route));
    fastify.ready(err => {
      if (err) throw err;
      fastify.swagger();
    });
    next();
  }

  async _createRouteHandler (route) {
    if (!route.handler) {
      throw new Error(`Route ${route.method} <${route.url}>: handler type missing`);
    }
    const createHandler = this[`${route.handler}${route.method}Handler`];
    if (!createHandler) {
      throw new Error(`Route ${route.method} <${route.url
          }>: unrecognized handler '${route.handler}${route.method}Handler'`);
    }
    const routeErrorMessage = `Exception caught during ${route.method} ${route.url}`;
    return asyncConnectToPartitionsIfMissingAndRetry(
        await createHandler.call(this, route),
        (error, request, reply) => {
          reply.code(500);
          reply.send(error.message);
          outputError(this.wrapErrorEvent(error, new Error(`${route.method} ${route.url}`),
              "\n\trequest.params:", ...dumpObject(request.params),
              "\n\trequest.query:", ...dumpObject(request.query),
              "\n\trequest.body:", ...dumpObject(request.body),
          ), routeErrorMessage, this.getLogger());
        });
  }

  async listCollectionGETHandler (route) {
    const connection = await this._engine.discourse.acquirePartitionConnection(
        route.config.valos.subject, { newConnection: false }).getActiveConnection();
    const vRoot = this._engine.getVrapper([connection.getPartitionRawId()]);
    await this._preloadListPartitions(vRoot, route);

    const kuery = ["§->"];
    this._buildKuery({ ...route.schema.response[200], valos: route.config.valos }, kuery);

    return (request, reply) => {
      this.logEvent(1, () => ["listCollection GET", route.url,
          "\n\trequest.query:", request.query,
          "\n\troute.schema.response[200]:", JSON.stringify(route.schema.response[200], null, 2),
          "\n\tkuery:", JSON.stringify(kuery, null, 2)]);
      const results = JSON.stringify(vRoot.get(kuery, { verbosity: 0 }), null, 2);
          // "\n\tschema:", JSON.stringify(route.schema.response[200], null, 2),
      this.logEvent(1, () => ["listCollection GET", route.url,
          "\n\tresults:", ...dumpObject(results)]);
      reply.send(results);
      // reply.code(200);
      // reply.send([]);
    };
  }

  async _preloadListPartitions (vRoot, route) {
    const listKuery = ["§->"];
    if (!this._extractValOSSchemaKuery(route.config.valos, listKuery)) {
      throw new Error(`Route <${route.url}> is missing valos schema predicate`);
    }
    listKuery.splice(listKuery.indexOf("relations") + 2);
    listKuery.push(["§map", false, "target"]);
    this.warnEvent("preloading route:", route.method, route.url,
        "\n\tpreload kuery:", JSON.stringify(listKuery),
        "\n\troute root:", vRoot.debugId());
    const vTargets = vRoot.get(listKuery);
    this.warnEvent("activating route resources:", route.method, route.url,
        "\n\tresources:", ...[].concat(...vTargets.map(vTarget => (!vTarget ? ["\n\t: <null>"]
            : ["\n\t:", vTarget.debugId()]))));
    await Promise.all(vTargets.map(vTarget => vTarget.activate()));
    this.logEvent("done activating route resources:", route.method, route.url,
        "\n\tresources:", ...[].concat(...vTargets.map(vTarget => (!vTarget ? ["\n\t: <null>"] : [
          "\n\t:", vTarget.debugId(),
          "\n\t\t:", vTarget.getPartitionConnection().isActive(),
              String(vTarget.getPartitionConnection().getPartitionURI()),
        ]))));
  }

  async retrieveResourceGETHandler (route) {
    // const connection = await this._engine.discourse.acquirePartitionConnection(
    //    route.config.valos.subject, { newConnection: false }).getActiveConnection();
    // const vRoot = this._engine.getVrapper([connection.getPartitionRawId()]);

    const kuery = ["§->"];
    this._buildKuery(route.schema.response[200], kuery);

    return (request, reply) => {
      const resourceId = request.params[route.config.idRouteParam];
      this.logEvent(1, () => ["retrieveResource GET", route.url, resourceId,
          "\n\trequest.query:", request.query]);
      const vResource = this._engine.tryVrapper([resourceId]);
      if (!vResource) {
        reply.code(404);
        reply.send(`Resource not found: <${resourceId}>`);
      } else {
        const results = JSON.stringify(vResource.get(kuery, { verbosity: 0 }), null, 2);
        reply.send(results);
      }
    };
  }

  async createResourcePOSTHandler (route) {
    // const connection = await this._engine.discourse.acquirePartitionConnection(
    //    route.config.valos.subject, { newConnection: false }).getActiveConnection();
    // const vRoot = this._engine.getVrapper([connection.getPartitionRawId()]);
    return (request, reply) => {
      this.logEvent("createResource POST", route.url,
        "\n\trequest.body:", request.body);
      reply.code(403);
      reply.send("Denied");
    };
  }

  async updateResourcePATCHHandler (route) {
    // const connection = await this._engine.discourse.acquirePartitionConnection(
    //    route.config.valos.subject, { newConnection: false }).getActiveConnection();
    // const vRoot = this._engine.getVrapper([connection.getPartitionRawId()]);
    return (request, reply) => {
      const resourceId = request.params[route.config.idRouteParam];
      this.logEvent("updateResource PATCH", route.url, resourceId,
          "\n\trequest.body:", request.body);
      reply.code(403);
      reply.send("Denied");
    };
  }

  async destroyResourceDELETEHandler (route) {
    // const connection = await this._engine.discourse.acquirePartitionConnection(
    //    route.config.valos.subject, { newConnection: false }).getActiveConnection();
    // const vRoot = this._engine.getVrapper([connection.getPartitionRawId()]);
    return (request, reply) => {
      const resourceId = request.params[route.config.idRouteParam];
      this.logEvent("destroyResource DELETE", route.url, resourceId);
      reply.code(403);
      reply.send("Denied");
    };
  }

  _buildKuery (jsonSchema, outerKuery, isValOSFields) {
    if (typeof jsonSchema === "string") {
      return this._buildKuery(
          this._fastify.getSchemas()[jsonSchema.slice(0, -1)], outerKuery, isValOSFields);
    }
    const innerKuery = this._extractValOSSchemaKuery(jsonSchema.valos, outerKuery);
    if (jsonSchema.type === "array") {
      if (!innerKuery) {
        throw new Error("json schema valos predicate missing with json schema type 'array'");
      }
      this._buildKuery(jsonSchema.items, innerKuery);
    } else if (jsonSchema.type === "object") {
      const objectKuery = {};
      Object.entries(jsonSchema.properties).forEach(([key, valueSchema]) => {
        let op;
        if (isValOSFields) {
          if (key === "id") op = ["§->", "rawId"];
          else if (key === "href") {
            if (!(jsonSchema.valos.route || {}).name) {
              throw new Error("href requested without json schema valos routeName");
            }
            op = ["§->", "target", false, "rawId", [
              "§+", path.join("/", this._prefix, jsonSchema.valos.route.name, "/"), ["§->", null],
            ]];
          } else if (key === "rel") op = "self";
          else op = ["§->", key];
        } else if (key === "$V") {
          this._buildKuery(valueSchema, (op = ["§->"]), true);
        } else {
          this._buildKuery(valueSchema, (op = ["§->"]));
          op = (op.length === 1) ? ["§..", key]
              : (valueSchema.type === "array") ? op
              : ["§->", ["§..", key], false, ...op.slice(1)];
        }
        objectKuery[key] = op;
      });
      (innerKuery || outerKuery).push(objectKuery);
    }
    return outerKuery;
  }

  _extractValOSSchemaKuery (valosSchema, outerKuery) {
    if (!(valosSchema || {}).predicate) return undefined;
    return valosSchema.predicate.split("!").reduce((innerKuery, part) => {
      if (innerKuery.length > 1) innerKuery.push(false);
      const fieldName = (part.match(/^(valos:field:|\$V:)(.*)$/) || [])[2];
      if (fieldName) {
        innerKuery.push(decodeURIComponent(fieldName));
        return innerKuery;
      }
      const propertyName = (part.match(/^(valos:Property:|\.:)(.*)$/) || [])[2];
      if (propertyName) {
        innerKuery.push(["§..", decodeURIComponent(propertyName)]);
        return innerKuery;
      }
      const relationName = (part.match(/^(valos:Relation:|-:)(.*)$/) || [])[2];
      if (relationName) {
        innerKuery.push(...VALEK.relations(relationName).toVAKON().slice(1));
        const mapper = ["§map"];
        innerKuery.push(mapper);
        return mapper;
      }
      throw new Error(`Unrecognized part <${part}> in valos predicate <${valosSchema.predicate}>`);
    }, outerKuery);
  }
}
