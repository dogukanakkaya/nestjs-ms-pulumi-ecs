import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

interface Props {
  stack: string;
  env: string;
  vpc: awsx.ec2.Vpc;
  cluster: aws.ecs.Cluster;
  namespace: aws.servicediscovery.PrivateDnsNamespace;
  servicesSg: aws.ec2.SecurityGroup;
}

export function configureOrder({ stack, env, vpc, cluster, namespace, servicesSg }: Props) {
  const orderServiceDiscovery = new aws.servicediscovery.Service(`order-service-discovery-${stack}`, {
    name: 'order',
    dnsConfig: {
      namespaceId: namespace.id,
      dnsRecords: [
        {
          ttl: 10,
          type: 'A',
        },
      ],
    },
    healthCheckCustomConfig: {
      failureThreshold: 1,
    },
  });

  const orderRepository = new awsx.ecr.Repository(`order-${stack}`);

  const orderImage = new awsx.ecr.Image(`order-${stack}`, {
    repositoryUrl: orderRepository.url,
    platform: 'linux/amd64',
    context: "../../",
    args: {
      APP: 'order',
      NODE_ENV: env
    },
    target: env
  });

  const orderService = new awsx.ecs.FargateService("order-service", {
    cluster: cluster.arn,
    taskDefinitionArgs: {
      container: {
        name: `order-${stack}`,
        image: orderImage.imageUri,
        cpu: 128,
        memory: 256,
        portMappings: [
          { containerPort: 3002 },
        ],
      },
    },
    networkConfiguration: {
      subnets: vpc.privateSubnetIds,
      securityGroups: [servicesSg.id]
    },
    serviceRegistries: {
      registryArn: orderServiceDiscovery.arn
    },
    desiredCount: 1,
  });

}