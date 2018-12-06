import implementInterface from "~/raem/tools/graphql/implementInterface";
import TransientFields from "~/raem/schema/TransientFields";
import Representation, { representationInterface } from "~/raem/schema/Representation";
import Resource from "~/raem/schema/Resource";

export default implementInterface("Description", "description",
    () => [Representation, Resource, TransientFields], representationInterface);
