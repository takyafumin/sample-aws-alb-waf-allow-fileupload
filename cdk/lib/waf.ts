import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface WafProps {
  readonly loadBalancerArn: string;
  readonly allowedPaths?: string[]; // e.g., ['/upload']
  readonly logRetentionDays?: logs.RetentionDays;
}

export class Waf extends Construct {
  readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: WafProps) {
    super(scope, id);

    const allowedPaths = props.allowedPaths ?? ['/upload'];

    // Helper statements
    const contentTypeMultipart: wafv2.CfnWebACL.StatementProperty = {
      byteMatchStatement: {
        fieldToMatch: { singleHeader: { name: 'content-type' } },
        positionalConstraint: 'CONTAINS',
        searchString: 'multipart/form-data',
        textTransformations: [{ priority: 0, type: 'LOWERCASE' }],
      },
    };

    const uriPathAllowed: wafv2.CfnWebACL.StatementProperty =
      allowedPaths.length === 1
        ? {
            byteMatchStatement: {
              fieldToMatch: { uriPath: {} },
              positionalConstraint: 'STARTS_WITH',
              searchString: allowedPaths[0],
              textTransformations: [{ priority: 0, type: 'NONE' }],
            },
          }
        : {
            orStatement: {
              statements: allowedPaths.map<wafv2.CfnWebACL.StatementProperty>((p) => ({
                byteMatchStatement: {
                  fieldToMatch: { uriPath: {} },
                  positionalConstraint: 'STARTS_WITH',
                  searchString: p,
                  textTransformations: [{ priority: 0, type: 'NONE' }],
                },
              })),
            },
          };

    const methodPostOrPut: wafv2.CfnWebACL.StatementProperty = {
      orStatement: {
        statements: [
          {
            byteMatchStatement: {
              fieldToMatch: { method: {} },
              positionalConstraint: 'EXACTLY',
              searchString: 'POST',
              textTransformations: [{ priority: 0, type: 'NONE' }],
            },
          },
          {
            byteMatchStatement: {
              fieldToMatch: { method: {} },
              positionalConstraint: 'EXACTLY',
              searchString: 'PUT',
              textTransformations: [{ priority: 0, type: 'NONE' }],
            },
          },
        ],
      },
    };

    // Rule 1: Block multipart/form-data outside allowed paths
    const blockMultipartOutsideAllowedPaths: wafv2.CfnWebACL.RuleProperty = {
      name: 'BlockMultipartOutsideAllowedPaths',
      priority: 0,
      action: { block: {} },
      statement: {
        andStatement: {
          statements: [
            contentTypeMultipart,
            { notStatement: { statement: uriPathAllowed } },
          ],
        },
      },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'BlockMultipartOutsideAllowedPaths',
        sampledRequestsEnabled: true,
      },
    };

    // Managed rules with scope-down: exclude allowed multipart uploads
    const managedRuleGroups = [
      'AWSManagedRulesCommonRuleSet',
      'AWSManagedRulesKnownBadInputsRuleSet',
      'AWSManagedRulesAmazonIpReputationList',
    ];

    let priority = 10;
    const managedRules: wafv2.CfnWebACL.RuleProperty[] = managedRuleGroups.map((groupName) => ({
      name: groupName,
      priority: priority++,
      overrideAction: { none: {} },
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: groupName,
          scopeDownStatement: {
            notStatement: {
              statement: {
                andStatement: {
                  statements: [methodPostOrPut, contentTypeMultipart, uriPathAllowed],
                },
              },
            },
          },
        },
      },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${groupName}-Scoped`,
        sampledRequestsEnabled: true,
      },
    }));

    this.webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      defaultAction: { allow: {} },
      scope: 'REGIONAL',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'WebAcl',
        sampledRequestsEnabled: true,
      },
      rules: [blockMultipartOutsideAllowedPaths, ...managedRules],
    });

    // Associate Web ACL to the ALB
    new wafv2.CfnWebACLAssociation(this, 'WebAclAssoc', {
      resourceArn: props.loadBalancerArn,
      webAclArn: this.webAcl.attrArn,
    });

    // WAF logging -> CloudWatch Logs
    const logGroup = new logs.LogGroup(this, 'WafLogGroup', {
      // WAF -> CloudWatch Logs は、ロググループ名が aws-waf-logs- で始まる必要がある
      logGroupName: `aws-waf-logs-${cdk.Stack.of(this).stackName}`,
      retention: props.logRetentionDays ?? logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // WAF requires the log group ARN without wildcard suffix
    const cwLogsArnForWaf = cdk.Stack.of(this).formatArn({
      service: 'logs',
      resource: 'log-group',
      arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
      resourceName: logGroup.logGroupName,
    });

    const wafLogsPolicy = new logs.CfnResourcePolicy(this, 'WafLogsPolicy', {
      policyName: 'AWSWAFLogs',
      policyDocument: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'AWSWAFLogsToCloudWatch',
            Effect: 'Allow',
            // WAF の CloudWatch Logs 配信サービスプリンシパル
            Principal: { Service: 'delivery.logs.amazonaws.com' },
            Action: [
              'logs:CreateLogStream',
              'logs:PutLogEvents',
              'logs:DescribeLogGroups',
              'logs:DescribeLogStreams',
            ],
            Resource: `${cwLogsArnForWaf}:*`,
          },
        ],
      }),
    });

    const wafLogging = new wafv2.CfnLoggingConfiguration(this, 'WafLogging', {
      resourceArn: this.webAcl.attrArn,
      logDestinationConfigs: [cwLogsArnForWaf],
    });

    // Ensure the resource policy is created before enabling logging
    wafLogging.node.addDependency(wafLogsPolicy);
  }
}
