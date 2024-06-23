import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import { cluster } from './ecs';

const stack = pulumi.getStack()
const env = stack === 'dev' ? 'development' : 'production';

const vpc = new awsx.ec2.Vpc(`vpc-${stack}`, {
  cidrBlock: "10.0.0.0/16",
  numberOfAvailabilityZones: 2,
  enableDnsHostnames: true,
});

const namespace = new aws.servicediscovery.PrivateDnsNamespace(`namespace-${stack}`, {
  vpc: vpc.vpcId,
  name: `service.local`,
});

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

const apiSg = new aws.ec2.SecurityGroup(`api-${stack}`, {
  vpcId: vpc.vpcId,
  ingress: [
    { protocol: "tcp", fromPort: 3000, toPort: 3000, cidrBlocks: ["0.0.0.0/0"] },
    { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] }
  ],
  egress: [
    { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }
  ]
});

const servicesSg = new aws.ec2.SecurityGroup(`services-${stack}`, {
  vpcId: vpc.vpcId,
  ingress: [
    { protocol: "tcp", fromPort: 3001, toPort: 3001, cidrBlocks: ["0.0.0.0/0"] },
    { protocol: "tcp", fromPort: 3002, toPort: 3002, cidrBlocks: ["0.0.0.0/0"] },
  ],
  // needs outbound access to pull images from ECR (you can allow to ECR CIDR by creating a vpc endpoint)
  egress: [
    { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }
  ]
});

const lb = new awsx.lb.ApplicationLoadBalancer(`lb-${stack}`, {
  subnetIds: vpc.publicSubnetIds,
  defaultTargetGroup: {
    vpcId: vpc.vpcId,
    port: 3000,
    healthCheck: {
      path: "/health",
      interval: 30,
      timeout: 15,
      healthyThreshold: 2,
      unhealthyThreshold: 2,
    },
  },
  securityGroups: [apiSg.id],
});

const apiRepository = new awsx.ecr.Repository(`api-${stack}`);
const orderRepository = new awsx.ecr.Repository(`order-${stack}`);
const paymentRepository = new awsx.ecr.Repository(`payment-${stack}`);

const apiImage = new awsx.ecr.Image(`api-${stack}`, {
  repositoryUrl: apiRepository.url,
  platform: 'linux/amd64',
  context: "../../",
  args: {
    APP: 'api',
    NODE_ENV: env
  },
  target: env
});

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

const apiService = new awsx.ecs.FargateService("api-service", {
  cluster: cluster.arn,
  taskDefinitionArgs: {
    container: {
      name: `api-${stack}`,
      image: apiImage.imageUri,
      cpu: 128,
      memory: 256,
      portMappings: [
        { containerPort: 3000, targetGroup: lb.defaultTargetGroup },
      ],
    },
  },
  networkConfiguration: {
    subnets: vpc.publicSubnetIds,
    securityGroups: [apiSg.id],
    assignPublicIp: true
  },
  desiredCount: 1,
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

export const vpcId = vpc.vpcId;
export const privateSubnetIds = vpc.privateSubnetIds;
export const publicSubnetIds = vpc.publicSubnetIds;
export const defaultSecurityGroupId = vpc.vpc.defaultSecurityGroupId;
export const defaultTargetGroupId = lb.defaultTargetGroup.id;
export const apiSecurityGroupId = apiSg.id;
export const servicesSecurityGroupId = servicesSg.id;
export const url = pulumi.interpolate`http://${lb.loadBalancer.dnsName}`;