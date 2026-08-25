# Architecture: Event-Driven Notification Service

## System Diagram
The following Mermaid.js sequence diagram maps the core workflow and interactions:

```mermaid
sequenceDiagram
Producer->>Kafka: user.signed_up
Kafka->>EmailConsumer: Sendgrid
Kafka->>SMSConsumer: Twilio
Kafka->>PushConsumer: FCM
```

## Component Breakdown
- **Core Technology**: TypeScript, KafkaJS, Node.js
- **Design Paradigm**: Emphasizes high availability, fault tolerance, and security.
