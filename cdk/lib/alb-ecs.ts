import { Construct } from 'constructs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';

export interface AlbEcsProps {
  readonly vpc: ec2.IVpc;
  readonly appDirectory?: string; // path to app Docker context
  readonly cpu?: number; // 256
  readonly memoryMiB?: number; // 512
  readonly desiredCount?: number; // 1
  readonly containerPort?: number; // 3000
  readonly appMaxFileSizeMb?: number; // 50
}

export class AlbEcs extends Construct {
  readonly cluster: ecs.Cluster;
  readonly service: ecsPatterns.ApplicationLoadBalancedFargateService;
  readonly listener: elbv2.ApplicationListener;

  constructor(scope: Construct, id: string, props: AlbEcsProps) {
    super(scope, id);

    const appDir = props.appDirectory ?? path.join(__dirname, '..', '..', 'app');

    this.cluster = new ecs.Cluster(this, 'Cluster', { vpc: props.vpc });

    this.service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Service', {
      cluster: this.cluster,
      cpu: props.cpu ?? 256,
      memoryLimitMiB: props.memoryMiB ?? 512,
      desiredCount: props.desiredCount ?? 1,
      publicLoadBalancer: true,
      listenerPort: 80,
      taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
      },
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset(appDir, {
          platform: ecrAssets.Platform.LINUX_AMD64,
        }),
        containerPort: props.containerPort ?? 3000,
        environment: {
          APP_MAX_FILE_SIZE_MB: String(props.appMaxFileSizeMb ?? 50),
          PORT: String(props.containerPort ?? 3000),
        },
      },
    });

    this.listener = this.service.listener;

    // Healthcheck to /health for acceptance criteria
    this.service.targetGroup.configureHealthCheck({
      path: '/health',
      healthyHttpCodes: '200',
    });

    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: this.service.loadBalancer.loadBalancerDnsName,
      exportName: cdk.Names.uniqueId(this) + ':AlbDnsName',
    });
  }
}
