import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface NetworkProps {
  readonly maxAzs?: number;
  readonly natGateways?: number;
  readonly vpcCidr?: string;
}

export class Network extends Construct {
  readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: NetworkProps = {}) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(props.vpcCidr ?? '10.0.0.0/16'),
      maxAzs: props.maxAzs ?? 2,
      natGateways: props.natGateways ?? 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC },
        { name: 'private-egress', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      ],
    });
  }
}

