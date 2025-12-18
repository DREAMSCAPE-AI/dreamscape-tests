# Guide de Test - Infrastructure Kafka DreamScape

**Date**: 2025-12-18
**Status**: Ready for Testing

## Vue d'ensemble

Ce guide décrit comment tester l'ensemble de l'infrastructure Kafka récemment implémentée pour DreamScape, incluant :

### Tickets Implémentés

#### Monitoring Kafka (DR-260)
- ✅ **DR-261**: Exposition des métriques Kafka (Kafka Exporter + JMX Exporter)
- ✅ **DR-262**: Dashboards Grafana pour Kafka
- ✅ **DR-263**: Règles d'alertes Kafka (12 alertes configurées)
- ✅ **DR-260**: Documentation complète du monitoring

#### Intégration Services
- ✅ **DR-264-267**: User Service - Événements Kafka (user.created, user.updated, etc.)
- ✅ **DR-374**: Auth Service - Événements Kafka (auth.login, auth.logout, etc.)
- ✅ **DR-378/380**: Payment Service - Événements Kafka (payment.completed, payment.failed, etc.)
- ✅ **DR-402/403**: Voyage Service - Événements Kafka (booking.created, search.performed, etc.)

---

## Prérequis

### 1. Docker Desktop

**Windows**:
```bash
# Vérifier que Docker est installé
docker --version

# Démarrer Docker Desktop
# Ouvrir Docker Desktop depuis le menu Démarrer
```

Docker Desktop **DOIT** être démarré avant de lancer les tests.

### 2. Ports Disponibles

Assurez-vous que les ports suivants sont libres :

| Service | Port | Usage |
|---------|------|-------|
| Kafka Broker | 9092 | Connexion Kafka |
| Zookeeper | 2181 | Coordination Kafka |
| Kafka UI | 8080 | Interface web Kafka (optionnel) |
| Prometheus | 9090 | Métriques |
| Grafana | 3000 | Dashboards |
| AlertManager | 9093 | Alertes |
| Kafka Exporter | 9308 | Métriques consumer groups |
| Kafka JMX Exporter | 5556 | Métriques broker |

### 3. Ressources Système

- **RAM**: Minimum 8 GB (16 GB recommandé)
- **CPU**: Minimum 4 cores
- **Disk**: 20 GB disponibles

---

## Tests Rapides (Quick Start)

### Option 1: Script Automatisé Complet

```bash
cd dreamscape-infra/scripts

# Rendre le script exécutable
chmod +x test-kafka-complete.sh

# Exécuter tous les tests
./test-kafka-complete.sh
```

**Ce script va**:
1. ✅ Vérifier Docker
2. ✅ Démarrer Kafka si nécessaire
3. ✅ Démarrer le monitoring stack
4. ✅ Vérifier tous les services
5. ✅ Tester les topics Kafka
6. ✅ Vérifier les consumer groups
7. ✅ Exécuter les tests d'intégration
8. ✅ Valider les métriques Prometheus
9. 📊 Générer un rapport de test

**Sortie attendue**: Rapport complet dans `/tmp/kafka-test-report.txt`

### Option 2: Test du Monitoring Uniquement

```bash
cd dreamscape-infra/scripts

# Valider le stack de monitoring
chmod +x validate-kafka-monitoring.sh
./validate-kafka-monitoring.sh
```

---

## Tests Détaillés (Étape par Étape)

### Phase 1: Démarrage de l'Infrastructure

#### 1.1 Créer le Réseau Docker

```bash
cd "C:\Users\kevco\Documents\EPITECH\DREAMSCAPE GITHUB MICROSERVICE"

# Créer le réseau (si pas déjà créé)
docker network create dreamscape-network

# Vérifier
docker network ls | grep dreamscape-network
```

#### 1.2 Démarrer Kafka

```bash
cd dreamscape-infra/docker

# Démarrer Kafka minimal
docker-compose -f docker-compose.kafka.yml up -d

# Avec interface UI (optionnel mais recommandé)
docker-compose -f docker-compose.kafka.yml --profile ui up -d

# Vérifier les logs
docker-compose -f docker-compose.kafka.yml logs -f kafka
```

**Attendre ~30 secondes** pour que Kafka soit complètement démarré.

**Vérification**:
```bash
# Tester la connexion
docker exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092

# Devrait afficher les versions des APIs Kafka
```

#### 1.3 Démarrer le Stack de Monitoring

```bash
cd dreamscape-infra/docker

# Démarrer Prometheus, Grafana, AlertManager, exporters
docker-compose -f docker-compose.monitoring.yml up -d

# Vérifier les logs
docker-compose -f docker-compose.monitoring.yml logs -f
```

**Attendre ~20 secondes** pour que tous les services démarrent.

**Vérification**:
```bash
# Tester l'accès aux services
curl http://localhost:9090/-/healthy         # Prometheus
curl http://localhost:3000/api/health        # Grafana
curl http://localhost:9308/metrics           # Kafka Exporter
curl http://localhost:5556/metrics           # JMX Exporter
curl http://localhost:9093/-/healthy         # AlertManager
```

#### 1.4 Démarrer les Services DreamScape (Optionnel)

```bash
cd dreamscape-services

# Démarrer le Core Pod (auth + user)
docker-compose -f docker-compose.core.prod.yml up -d

# Démarrer le Business Pod (payment + voyage + ai)
docker-compose -f docker-compose.business.prod.yml up -d

# Vérifier
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

---

### Phase 2: Vérification des Topics Kafka

#### 2.1 Lister les Topics

```bash
# Lister tous les topics
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Topics attendus (créés automatiquement lors du premier publish):
# - dreamscape.user.created
# - dreamscape.user.updated
# - dreamscape.user.profile.updated
# - dreamscape.user.preferences.updated
# - dreamscape.auth.login
# - dreamscape.auth.logout
# - dreamscape.payment.initiated
# - dreamscape.payment.completed
# - dreamscape.payment.failed
# - dreamscape.voyage.booking.created
# - dreamscape.voyage.search.performed
```

#### 2.2 Créer un Topic Manuellement (Test)

```bash
# Créer un topic de test
docker exec kafka kafka-topics \
  --bootstrap-server localhost:9092 \
  --create \
  --topic test.dreamscape.event \
  --partitions 3 \
  --replication-factor 1

# Décrire le topic
docker exec kafka kafka-topics \
  --bootstrap-server localhost:9092 \
  --describe \
  --topic test.dreamscape.event
```

#### 2.3 Produire et Consommer un Message de Test

```bash
# Produire un message de test
echo "Hello from DreamScape Kafka!" | docker exec -i kafka \
  kafka-console-producer \
  --bootstrap-server localhost:9092 \
  --topic test.dreamscape.event

# Consommer le message
docker exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic test.dreamscape.event \
  --from-beginning \
  --max-messages 1
```

**Sortie attendue**: `Hello from DreamScape Kafka!`

---

### Phase 3: Vérification du Monitoring

#### 3.1 Prometheus - Métriques Kafka

**Accès**: http://localhost:9090

**Requêtes à tester dans Prometheus UI**:

```promql
# Vérifier que Kafka exporter est up
up{job="kafka-exporter"}

# Consumer lag (si des consumers existent)
kafka_consumergroup_lag

# Messages entrants par seconde
rate(kafka_server_brokertopicmetrics_messagesin_total[5m])

# Partitions sous-répliquées
kafka_server_replicamanager_underreplicatedpartitions

# Partitions offline
kafka_controller_kafkacontroller_offlinepartitionscount

# Request rate
rate(kafka_network_requestmetrics_requests_total[5m])
```

**Vérifier les targets**:
- http://localhost:9090/targets
- Chercher `kafka-exporter` et `kafka-jmx`
- Status devrait être **UP** (vert)

#### 3.2 Grafana - Dashboards Kafka

**Accès**: http://localhost:3000
**Credentials**: admin / admin

**Steps**:
1. Login avec admin/admin
2. Aller dans **Dashboards** > **Browse**
3. Chercher "Kafka Monitoring - DreamScape"
4. Vérifier les 7 panneaux:
   - ✅ Kafka Broker Status
   - ✅ Kafka Throughput - Messages In
   - ✅ Consumer Lag by Group and Topic
   - ✅ Under-Replicated Partitions
   - ✅ Offline Partitions
   - ✅ Request Rate by Type
   - ✅ Request Latency (P99)

**Dashboard UID**: `kafka-monitoring-dreamscape`

#### 3.3 AlertManager - Alertes Kafka

**Accès**: http://localhost:9093

**Vérifier**:
- AlertManager est accessible
- Aucune alerte active (si tout est sain)
- Configuration des routes d'alertes

**Tester une alerte** (optionnel):
```bash
# Arrêter Kafka pour déclencher l'alerte KafkaBrokerDown
docker stop kafka

# Attendre 2 minutes (threshold de l'alerte)
# Vérifier http://localhost:9093 - une alerte devrait apparaître

# Redémarrer Kafka
docker start kafka
```

#### 3.4 Kafka UI (si démarré avec --profile ui)

**Accès**: http://localhost:8080

**Fonctionnalités**:
- Vue graphique des topics
- Inspection des messages
- Gestion des consumer groups
- Vue du cluster Kafka

---

### Phase 4: Tests d'Intégration Automatisés

#### 4.1 Tests du Monitoring Kafka

```bash
cd dreamscape-tests

# Installer les dépendances (si pas déjà fait)
npm install

# Exécuter les tests du monitoring
npm run test integration/monitoring/kafka-monitoring-validation.test.ts
```

**22 tests** seront exécutés:
- Service availability (5)
- Metrics collection (7)
- Grafana dashboard (2)
- Alert rules (4)
- Integration health (1)
- Documentation (3)

**Sortie attendue**: Tous les tests devraient passer ✅

#### 4.2 Tests des Événements User (DR-264)

```bash
cd dreamscape-tests

# Vérifier que user-service est running
docker ps | grep user-service

# Exécuter les tests Kafka user events
npm run test integration/kafka/user-events-kafka.test.ts
```

**Tests**:
- ✅ UserProfileUpdated event on profile creation
- ✅ UserProfileUpdated event on avatar upload
- ✅ UserPreferencesUpdated event on preferences update
- ✅ UserUpdated event on user info change
- ✅ Event structure validation

#### 4.3 Tests des Événements Payment (DR-378)

```bash
cd dreamscape-tests

# Vérifier que payment-service est running
docker ps | grep payment-service

# Exécuter les tests (quand implémentés)
npm run test integration/kafka/payment-events-kafka.test.ts
```

---

### Phase 5: Tests End-to-End

#### 5.1 Test du Flow User Creation

**Objectif**: Vérifier que la création d'un user publie bien l'événement Kafka

```bash
# 1. S'authentifier (obtenir un token)
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.kafka@dreamscape.com",
    "password": "Test1234!",
    "firstName": "Kafka",
    "lastName": "Test"
  }'

# 2. Vérifier dans les logs user-service que l'événement a été publié
docker logs user-service | grep "user.created"

# 3. Vérifier dans Prometheus que le message a été compté
# http://localhost:9090
# Query: kafka_server_brokertopicmetrics_messagesin_total
```

#### 5.2 Test du Flow Payment → Booking (Saga Pattern)

**Prérequis**: payment-service et voyage-service running

```bash
# 1. Créer une réservation (status PENDING_PAYMENT)
# 2. Initier un paiement (publie payment.initiated)
# 3. Simuler webhook Stripe success (publie payment.completed)
# 4. Vérifier que voyage-service a consommé l'événement et confirmé le booking
```

**Voir**: `dreamscape-services/payment/KAFKA_EVENTS_GUIDE.md` pour le détail du Saga Pattern.

---

### Phase 6: Consumer Groups Monitoring

#### 6.1 Lister les Consumer Groups

```bash
docker exec kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --list

# Consumer groups attendus:
# - dreamscape-auth-service-group
# - dreamscape-user-service-group
# - dreamscape-payment-service-group
# - dreamscape-voyage-service-group
# - dreamscape-ai-service-group
```

#### 6.2 Voir les Détails d'un Consumer Group

```bash
# Exemple: user-service
docker exec kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group dreamscape-user-service-group \
  --describe

# Affiche:
# - Topic, Partition, Current Offset, Log End Offset, LAG
```

#### 6.3 Vérifier le Lag dans Grafana

1. Ouvrir http://localhost:3000
2. Dashboard "Kafka Monitoring - DreamScape"
3. Panel "Consumer Lag by Group and Topic"
4. Vérifier que le lag est **< 1000** (vert)

---

## Troubleshooting

### Problème 1: Docker Desktop ne démarre pas

**Symptôme**:
```
error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.51/containers/json": open //./pipe/dockerDesktopLinuxEngine: Le fichier spécifié est introuvable.
```

**Solution**:
1. Ouvrir Docker Desktop manuellement
2. Attendre qu'il soit complètement démarré (icône Docker en bas à droite)
3. Relancer les commandes

### Problème 2: Kafka ne démarre pas

**Symptôme**: `docker logs kafka` affiche des erreurs

**Solutions**:
```bash
# 1. Vérifier les ports
netstat -an | findstr "9092"

# 2. Nettoyer et redémarrer
docker-compose -f docker-compose.kafka.yml down
docker-compose -f docker-compose.kafka.yml up -d

# 3. Vérifier les logs
docker logs kafka -f
```

### Problème 3: Prometheus ne scrape pas Kafka

**Symptôme**: Aucune métrique Kafka dans Prometheus

**Solutions**:
```bash
# 1. Vérifier que les exporters sont running
docker ps | grep -E "(kafka-exporter|kafka-jmx-exporter)"

# 2. Tester les métriques directement
curl http://localhost:9308/metrics | grep kafka_
curl http://localhost:5556/metrics | grep kafka_server_

# 3. Vérifier les targets dans Prometheus
# http://localhost:9090/targets
# Chercher kafka-exporter et kafka-jmx - Status doit être UP

# 4. Vérifier le réseau Docker
docker network inspect dreamscape-network
```

### Problème 4: Consumer Lag élevé

**Symptôme**: Lag > 1000 dans Grafana ou Prometheus

**Solutions**:
```bash
# 1. Vérifier les logs du consumer
docker logs user-service | grep -i kafka

# 2. Vérifier que le service consomme les messages
docker exec kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group dreamscape-user-service-group \
  --describe

# 3. Redémarrer le service consommateur
docker restart user-service

# 4. Si le lag persiste, scaler le service
docker-compose -f docker-compose.core.prod.yml up -d --scale user-service=2
```

### Problème 5: Tests d'intégration échouent

**Symptôme**: Tests Jest timeout ou échecs

**Solutions**:
```bash
# 1. Vérifier que tous les services sont running
docker ps

# 2. Augmenter les timeouts dans les tests
# Éditer les fichiers .test.ts et augmenter les timeouts

# 3. Vérifier la connectivité
curl http://localhost:9090/-/healthy
curl http://localhost:3000/api/health
curl http://localhost:9308/metrics

# 4. Exécuter les tests avec plus de verbosité
npm run test integration/monitoring/kafka-monitoring-validation.test.ts --verbose
```

---

## Checklist de Validation Complète

Utilisez cette checklist pour valider que toute l'infrastructure Kafka fonctionne:

### Infrastructure
- [ ] Docker Desktop est démarré
- [ ] Réseau `dreamscape-network` existe
- [ ] Kafka broker est running (port 9092)
- [ ] Zookeeper est running (port 2181)
- [ ] Kafka UI est accessible (port 8080, optionnel)

### Monitoring
- [ ] Prometheus est running (port 9090)
- [ ] Grafana est running (port 3000)
- [ ] AlertManager est running (port 9093)
- [ ] Kafka Exporter est running (port 9308)
- [ ] Kafka JMX Exporter est running (port 5556)
- [ ] Prometheus scrape kafka-exporter target (UP)
- [ ] Prometheus scrape kafka-jmx target (UP)
- [ ] Dashboard Grafana "Kafka Monitoring - DreamScape" existe
- [ ] 12 alertes Kafka sont configurées dans Prometheus

### Topics & Events
- [ ] Peut créer un topic de test
- [ ] Peut produire un message de test
- [ ] Peut consommer un message de test
- [ ] Topics `dreamscape.*` existent (ou seront auto-créés)

### Services (si démarrés)
- [ ] auth-service est connecté à Kafka
- [ ] user-service est connecté à Kafka
- [ ] payment-service est connecté à Kafka
- [ ] voyage-service est connecté à Kafka
- [ ] Consumer groups sont visibles dans Kafka

### Tests
- [ ] Tests du monitoring passent (22 tests)
- [ ] Tests user events passent (si user-service running)
- [ ] Tests payment events passent (si payment-service running)
- [ ] Script `test-kafka-complete.sh` passe avec >80% de réussite

### Métriques
- [ ] `kafka_consumergroup_lag` est disponible dans Prometheus
- [ ] `kafka_server_brokertopicmetrics_messagesin_total` est disponible
- [ ] `kafka_server_replicamanager_underreplicatedpartitions` est disponible
- [ ] `kafka_controller_kafkacontroller_offlinepartitionscount` est disponible
- [ ] Dashboard Grafana affiche des données réelles

---

## Documentation de Référence

### Documents Techniques
- `dreamscape-infra/docs/KAFKA-MONITORING.md` - Guide complet du monitoring
- `dreamscape-infra/docs/KAFKA-MONITORING-COMPLETION.md` - Résumé d'implémentation
- `dreamscape-services/docs/KAFKA-ARCHITECTURE.md` - Architecture événementielle
- `dreamscape-services/payment/KAFKA_EVENTS_GUIDE.md` - Guide événements payment

### Scripts
- `dreamscape-infra/scripts/test-kafka-complete.sh` - Tests complets automatisés
- `dreamscape-infra/scripts/validate-kafka-monitoring.sh` - Validation monitoring

### Tests
- `dreamscape-tests/integration/monitoring/kafka-monitoring-validation.test.ts`
- `dreamscape-tests/integration/kafka/user-events-kafka.test.ts`
- `dreamscape-tests/integration/kafka/payment-events-kafka.test.ts`

### Configuration
- `dreamscape-infra/docker/docker-compose.kafka.yml`
- `dreamscape-infra/docker/docker-compose.monitoring.yml`
- `dreamscape-infra/monitoring/prometheus.yml`
- `dreamscape-infra/monitoring/rules/kafka-alerts.yaml`
- `dreamscape-infra/monitoring/grafana/dashboards/kafka-monitoring.json`

---

## Commandes Utiles

### Gestion Kafka
```bash
# Lister topics
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Créer topic
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --create --topic <name> --partitions 3 --replication-factor 1

# Décrire topic
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --describe --topic <name>

# Supprimer topic
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --delete --topic <name>

# Lister consumer groups
docker exec kafka kafka-consumer-groups --bootstrap-server localhost:9092 --list

# Décrire consumer group (voir lag)
docker exec kafka kafka-consumer-groups --bootstrap-server localhost:9092 --group <group-name> --describe
```

### Gestion Docker
```bash
# Voir tous les conteneurs DreamScape
docker ps --filter "name=dreamscape"

# Logs d'un service
docker logs -f <service-name>

# Redémarrer un service
docker restart <service-name>

# Stopper tous les services
docker-compose -f docker-compose.kafka.yml down
docker-compose -f docker-compose.monitoring.yml down

# Nettoyer tout (ATTENTION: supprime les volumes)
docker-compose -f docker-compose.kafka.yml down -v
docker-compose -f docker-compose.monitoring.yml down -v
```

### Monitoring
```bash
# Vérifier santé Prometheus
curl http://localhost:9090/-/healthy

# Query Prometheus
curl 'http://localhost:9090/api/v1/query?query=kafka_consumergroup_lag'

# Vérifier targets Prometheus
curl http://localhost:9090/api/v1/targets | jq

# Vérifier alertes actives
curl http://localhost:9090/api/v1/alerts | jq

# Login Grafana API
curl -X GET http://localhost:3000/api/dashboards/uid/kafka-monitoring-dreamscape \
  -u admin:admin | jq
```

---

## Next Steps

Une fois tous les tests validés:

1. **Monitoring en Production**
   - Configurer les notifications AlertManager (email, Slack, PagerDuty)
   - Ajuster les seuils d'alertes selon la charge réelle
   - Mettre en place la rotation des logs

2. **Performance Tuning**
   - Optimiser le nombre de partitions par topic
   - Ajuster les timeouts des consumers
   - Configurer le batching des producers

3. **Scalabilité**
   - Tester avec plusieurs instances de services
   - Vérifier le load balancing des consumer groups
   - Mesurer le throughput maximum

4. **Saga Patterns**
   - Implémenter les compensating transactions
   - Ajouter des Dead Letter Queues
   - Tester les scenarios d'échec

---

**Version**: 1.0
**Dernière mise à jour**: 2025-12-18
**Auteur**: DreamScape DevOps Team
