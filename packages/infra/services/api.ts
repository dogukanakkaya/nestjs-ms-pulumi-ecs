import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

interface Props {
  stack: string;
  env: string;
  vpc: awsx.ec2.Vpc;
  cluster: aws.ecs.Cluster;
  apiSg: aws.ec2.SecurityGroup;
  lb: awsx.lb.ApplicationLoadBalancer;
}

export function configureApi({ stack, env, vpc, cluster, apiSg, lb }: Props) {
  const apiRepository = new awsx.ecr.Repository(`api-${stack}`);

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
}