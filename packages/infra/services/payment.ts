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

export function configurePayment({ stack, env, vpc, cluster, namespace, servicesSg }: Props) {
  const paymentServiceDiscovery = new aws.servicediscovery.Service(`payment-service-discovery-${stack}`, {
    name: 'payment',
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

  const paymentRepository = new awsx.ecr.Repository(`payment-${stack}`);

  const paymentImage = new awsx.ecr.Image(`payment-${stack}`, {
    repositoryUrl: paymentRepository.url,
    platform: 'linux/amd64',
    context: "../../",
    args: {
      APP: 'payment',
      NODE_ENV: env
    },
    target: env
  });

  const paymentService = new awsx.ecs.FargateService("payment-service", {
    cluster: cluster.arn,
    taskDefinitionArgs: {
      container: {
        name: `payment-${stack}`,
        image: paymentImage.imageUri,
        cpu: 128,
        memory: 256,
        essential: true,
        portMappings: [
          {
            containerPort: 3001,
          },
        ],
      },
    },
    networkConfiguration: {
      subnets: vpc.privateSubnetIds,
      securityGroups: [servicesSg.id]
    },
    serviceRegistries: {
      registryArn: paymentServiceDiscovery.arn
    },
    desiredCount: 1,
  });
}