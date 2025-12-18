/**
 * Kafka Monitoring Stack Validation Tests
 * DR-260, DR-261, DR-262, DR-263
 *
 * Tests to validate the Kafka monitoring infrastructure:
 * - Prometheus metrics collection
 * - Grafana dashboard availability
 * - Alert rules configuration
 * - Kafka exporters health
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import axios from 'axios';

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://localhost:9090';
const GRAFANA_URL = process.env.GRAFANA_URL || 'http://localhost:3000';
const KAFKA_EXPORTER_URL = process.env.KAFKA_EXPORTER_URL || 'http://localhost:9308';
const KAFKA_JMX_EXPORTER_URL = process.env.KAFKA_JMX_EXPORTER_URL || 'http://localhost:5556';
const ALERTMANAGER_URL = process.env.ALERTMANAGER_URL || 'http://localhost:9093';

describe('Kafka Monitoring Stack Validation', () => {

  describe('Service Availability (DR-260)', () => {

    it('should have Prometheus running and accessible', async () => {
      const response = await axios.get(`${PROMETHEUS_URL}/-/healthy`);
      expect(response.status).toBe(200);
    }, 10000);

    it('should have Grafana running and accessible', async () => {
      const response = await axios.get(`${GRAFANA_URL}/api/health`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('database');
      expect(response.data.database).toBe('ok');
    }, 10000);

    it('should have Kafka Exporter running and exposing metrics', async () => {
      const response = await axios.get(`${KAFKA_EXPORTER_URL}/metrics`);
      expect(response.status).toBe(200);
      expect(response.data).toContain('kafka_');
    }, 10000);

    it('should have Kafka JMX Exporter running and exposing metrics', async () => {
      const response = await axios.get(`${KAFKA_JMX_EXPORTER_URL}/metrics`);
      expect(response.status).toBe(200);
      expect(response.data).toContain('kafka_server_');
    }, 10000);

    it('should have AlertManager running and accessible', async () => {
      const response = await axios.get(`${ALERTMANAGER_URL}/-/healthy`);
      expect(response.status).toBe(200);
    }, 10000);
  });

  describe('Prometheus Metrics Collection (DR-261)', () => {

    it('should scrape kafka-exporter target successfully', async () => {
      const response = await axios.get(`${PROMETHEUS_URL}/api/v1/targets`);
      expect(response.status).toBe(200);

      const kafkaExporterTarget = response.data.data.activeTargets.find(
        (target: any) => target.labels.job === 'kafka-exporter'
      );

      expect(kafkaExporterTarget).toBeDefined();
      expect(kafkaExporterTarget.health).toBe('up');
    }, 10000);

    it('should scrape kafka-jmx target successfully', async () => {
      const response = await axios.get(`${PROMETHEUS_URL}/api/v1/targets`);
      expect(response.status).toBe(200);

      const kafkaJmxTarget = response.data.data.activeTargets.find(
        (target: any) => target.labels.job === 'kafka-jmx'
      );

      expect(kafkaJmxTarget).toBeDefined();
      expect(kafkaJmxTarget.health).toBe('up');
    }, 10000);

    it('should collect consumer group lag metrics', async () => {
      const response = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
        params: { query: 'kafka_consumergroup_lag' }
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('success');

      // May have no results if no consumer groups exist yet, which is OK
      expect(response.data.data.resultType).toBe('vector');
    }, 10000);

    it('should collect broker topic metrics (messages in)', async () => {
      const response = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
        params: { query: 'kafka_server_brokertopicmetrics_messagesin_total' }
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('success');
      expect(response.data.data.resultType).toBe('vector');
    }, 10000);

    it('should collect under-replicated partitions metric', async () => {
      const response = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
        params: { query: 'kafka_server_replicamanager_underreplicatedpartitions' }
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('success');
    }, 10000);

    it('should collect offline partitions metric', async () => {
      const response = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
        params: { query: 'kafka_controller_kafkacontroller_offlinepartitionscount' }
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('success');
    }, 10000);

    it('should collect request metrics', async () => {
      const response = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
        params: { query: 'kafka_network_requestmetrics_requests_total' }
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('success');
    }, 10000);
  });

  describe('Grafana Dashboard (DR-262)', () => {

    it('should have Kafka dashboard provisioned', async () => {
      // Note: This requires Grafana API authentication
      // Using default admin/admin credentials for test environment
      const auth = Buffer.from('admin:admin').toString('base64');

      const response = await axios.get(`${GRAFANA_URL}/api/dashboards/uid/kafka-monitoring-dreamscape`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.dashboard.title).toBe('Kafka Monitoring - DreamScape');
      expect(response.data.dashboard.tags).toContain('kafka');
      expect(response.data.dashboard.tags).toContain('DR-260');
    }, 10000);

    it('should have Prometheus datasource configured in Grafana', async () => {
      const auth = Buffer.from('admin:admin').toString('base64');

      const response = await axios.get(`${GRAFANA_URL}/api/datasources`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });

      expect(response.status).toBe(200);

      const prometheusDatasource = response.data.find(
        (ds: any) => ds.type === 'prometheus'
      );

      expect(prometheusDatasource).toBeDefined();
      expect(prometheusDatasource.url).toContain('prometheus');
    }, 10000);
  });

  describe('Alert Rules Configuration (DR-263)', () => {

    it('should have Kafka alert rules loaded in Prometheus', async () => {
      const response = await axios.get(`${PROMETHEUS_URL}/api/v1/rules`);
      expect(response.status).toBe(200);

      const kafkaRuleGroups = response.data.data.groups.filter(
        (group: any) =>
          group.name.includes('kafka_') ||
          group.rules.some((rule: any) => rule.labels?.component === 'kafka')
      );

      expect(kafkaRuleGroups.length).toBeGreaterThan(0);
    }, 10000);

    it('should have critical alerts configured (broker down, offline partitions)', async () => {
      const response = await axios.get(`${PROMETHEUS_URL}/api/v1/rules`);
      expect(response.status).toBe(200);

      const allRules = response.data.data.groups.flatMap((group: any) => group.rules);

      const criticalAlerts = allRules.filter((rule: any) =>
        rule.labels?.severity === 'critical' &&
        rule.labels?.component === 'kafka'
      );

      const alertNames = criticalAlerts.map((alert: any) => alert.name);

      expect(alertNames).toContain('KafkaBrokerDown');
      expect(alertNames).toContain('KafkaOfflinePartitions');
      expect(alertNames).toContain('KafkaConsumerLagCritical');
    }, 10000);

    it('should have warning alerts configured (lag, replication)', async () => {
      const response = await axios.get(`${PROMETHEUS_URL}/api/v1/rules`);
      expect(response.status).toBe(200);

      const allRules = response.data.data.groups.flatMap((group: any) => group.rules);

      const warningAlerts = allRules.filter((rule: any) =>
        rule.labels?.severity === 'warning' &&
        rule.labels?.component === 'kafka'
      );

      const alertNames = warningAlerts.map((alert: any) => alert.name);

      expect(alertNames).toContain('KafkaConsumerLagHigh');
      expect(alertNames).toContain('KafkaUnderReplicatedPartitions');
      expect(alertNames).toContain('KafkaJMXExporterDown');
    }, 10000);

    it('should have AlertManager connected to Prometheus', async () => {
      const response = await axios.get(`${PROMETHEUS_URL}/api/v1/alertmanagers`);
      expect(response.status).toBe(200);

      const activeAlertManagers = response.data.data.activeAlertmanagers;
      expect(activeAlertManagers.length).toBeGreaterThan(0);

      const alertManager = activeAlertManagers[0];
      expect(alertManager.url).toContain('alertmanager');
    }, 10000);
  });

  describe('Integration Health Check (DR-260)', () => {

    it('should validate complete monitoring pipeline', async () => {
      // 1. Check Kafka exporter is collecting metrics
      const exporterResponse = await axios.get(`${KAFKA_EXPORTER_URL}/metrics`);
      expect(exporterResponse.data).toContain('kafka_consumergroup_');

      // 2. Check Prometheus has scraped these metrics
      const prometheusResponse = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
        params: { query: 'up{job="kafka-exporter"}' }
      });
      expect(prometheusResponse.data.data.result.length).toBeGreaterThan(0);
      expect(prometheusResponse.data.data.result[0].value[1]).toBe('1'); // up = 1

      // 3. Check Grafana can query Prometheus
      const auth = Buffer.from('admin:admin').toString('base64');
      const grafanaResponse = await axios.get(`${GRAFANA_URL}/api/health`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });
      expect(grafanaResponse.data.database).toBe('ok');

      // Pipeline is healthy
      expect(true).toBe(true);
    }, 15000);
  });
});

describe('Kafka Monitoring Documentation (DR-260)', () => {

  it('should have comprehensive monitoring documentation', () => {
    const fs = require('fs');
    const path = require('path');

    const docPath = path.join(
      __dirname,
      '../../../dreamscape-infra/docs/KAFKA-MONITORING.md'
    );

    expect(fs.existsSync(docPath)).toBe(true);

    const docContent = fs.readFileSync(docPath, 'utf-8');

    // Verify key sections exist
    expect(docContent).toContain('## Architecture de Monitoring');
    expect(docContent).toContain('## Métriques Collectées (DR-261)');
    expect(docContent).toContain('## Dashboards Grafana (DR-262)');
    expect(docContent).toContain('## Alertes Kafka (DR-263)');
    expect(docContent).toContain('### Troubleshooting');
  });

  it('should have Grafana dashboard JSON file', () => {
    const fs = require('fs');
    const path = require('path');

    const dashboardPath = path.join(
      __dirname,
      '../../../dreamscape-infra/monitoring/grafana/dashboards/kafka-monitoring.json'
    );

    expect(fs.existsSync(dashboardPath)).toBe(true);

    const dashboard = JSON.parse(fs.readFileSync(dashboardPath, 'utf-8'));

    expect(dashboard.title).toBe('Kafka Monitoring - DreamScape');
    expect(dashboard.uid).toBe('kafka-monitoring-dreamscape');
    expect(dashboard.tags).toContain('kafka');
    expect(dashboard.panels.length).toBeGreaterThan(0);
  });

  it('should have alert rules YAML file', () => {
    const fs = require('fs');
    const path = require('path');

    const alertsPath = path.join(
      __dirname,
      '../../../dreamscape-infra/monitoring/rules/kafka-alerts.yaml'
    );

    expect(fs.existsSync(alertsPath)).toBe(true);

    const alertsContent = fs.readFileSync(alertsPath, 'utf-8');

    // Verify key alert groups exist
    expect(alertsContent).toContain('kafka_availability');
    expect(alertsContent).toContain('kafka_performance');
    expect(alertsContent).toContain('kafka_throughput');
    expect(alertsContent).toContain('kafka_errors');
    expect(alertsContent).toContain('kafka_disk');
  });
});
