import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { MySQL2Instrumentation } from '@opentelemetry/instrumentation-mysql2';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = typeof process.env.VITEST !== 'undefined' || process.env.NODE_ENV === 'test';

if (!isProduction && !isTest) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
}

export const sdk = isTest
    ? (null as unknown as NodeSDK)
    : new NodeSDK({
          resource: resourceFromAttributes({
              'service.name': 'disciplina-api',
              'service.version': process.env.npm_package_version || '1.0.0',
              'deployment.environment': process.env.NODE_ENV || 'development',
          }),
          traceExporter: new OTLPTraceExporter(),
          instrumentations: [
              new HttpInstrumentation(),
              new ExpressInstrumentation(),
              new GraphQLInstrumentation({
                  allowValues: process.env.OTEL_GRAPHQL_ALLOW_VALUES === 'true',
              }),
              new MySQL2Instrumentation(),
              new MongoDBInstrumentation(),
              new PinoInstrumentation(),
          ],
      });

if (!isTest) {
    sdk.start();
}
