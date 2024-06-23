import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const stack = pulumi.getStack()

export const cluster = new aws.ecs.Cluster(`cluster-${stack}`);