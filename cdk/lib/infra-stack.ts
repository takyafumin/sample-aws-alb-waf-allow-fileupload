import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Network } from './network';
import { AlbEcs } from './alb-ecs';
import { Waf } from './waf';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const network = new Network(this, 'Network', {
      maxAzs: 2,
      natGateways: 1,
    });

    const albEcs = new AlbEcs(this, 'AlbEcs', {
      vpc: network.vpc,
      containerPort: 3000,
      appMaxFileSizeMb: 50,
    });

    new Waf(this, 'Waf', {
      loadBalancerArn: albEcs.service.loadBalancer.loadBalancerArn,
      allowedPaths: ['/upload'],
    });
  }
}
