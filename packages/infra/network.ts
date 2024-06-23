import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

interface Props {
  stack: string;
}

export function configureNetwork({ stack }: Props) {
  const vpc = new awsx.ec2.Vpc(`vpc-${stack}`, {
    cidrBlock: "10.0.0.0/16",
    numberOfAvailabilityZones: 2,
    enableDnsHostnames: true,
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

  return { vpc, apiSg, servicesSg, lb }
}