import * as pulumi from "@pulumi/pulumi";
import { configureNetwork } from './network';
import { configureApi, configureOrder, configurePayment, configureServices } from './services';

const stack = pulumi.getStack()
const env = stack === 'dev' ? 'development' : 'production';

const { vpc, apiSg, servicesSg, lb } = configureNetwork({ stack });
const { cluster, namespace } = configureServices({ stack, vpc });

configureApi({ stack, env, vpc, cluster, apiSg, lb });
configureOrder({ stack, env, vpc, cluster, namespace, servicesSg });
configurePayment({ stack, env, vpc, cluster, namespace, servicesSg });

export const vpcId = vpc.vpcId;
export const privateSubnetIds = vpc.privateSubnetIds;
export const publicSubnetIds = vpc.publicSubnetIds;
export const defaultSecurityGroupId = vpc.vpc.defaultSecurityGroupId;
export const defaultTargetGroupId = lb.defaultTargetGroup.id;
export const apiSecurityGroupId = apiSg.id;
export const servicesSecurityGroupId = servicesSg.id;
export const url = pulumi.interpolate`http://${lb.loadBalancer.dnsName}`;