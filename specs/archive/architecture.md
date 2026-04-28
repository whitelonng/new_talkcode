# TalkCody Architecture

## Overview

TalkCody 1.0 adopts a unified AI Agent architecture that supports both **Local** and **Service** deployment modes. All UI clients (Desktop, Mobile, Web, CLI, IM bots) function as thin interaction layers, communicating with the backend Agent service through a unified interface.

## Architecture Diagram

```
+----------------------------------------------------------------------------------+
|                                 UI / CLIENT LAYER                                |
+----------------------------------------------------------------------------------+
|  +----------+  +----------+  +----------+  +----------+  +----------+  +--------+ |
|  | Desktop  |  | Mobile   |  |   Web    |  |   CLI    |  |  IM Bots |  |  Other | |
|  | (mac/lnx)|  | iOS/Andr |  | Browser  |  |  TTY     |  | Feishu/  |  |  SDKs  | |
|  | Windows  |  |          |  |          |  |          |  | TG/Slack |  |        | |
|  +----------+  +----------+  +----------+  +----------+  +----------+  +--------+ |
+----------------------------------------------------------------------------------+
        |                                    |
        |                                    |
   +----+----+                          +----+----+
   |  LOCAL  |                          | SERVICE |
   |  MODE   |                          |  MODE   |
   | (Device)|                          | (Cloud) |
   +----+----+                          +----+----+
        |                                    |
        +----------------+-------------------+
                         |
                         v
+----------------------------------------------------------------------------------+
|                                  AGENT GATEWAY                                   |
|  +------------------+  +------------------+  +------------------+  +-----------+ |
|  | Auth & Tenancy   |  | Routing & Policy |  | Rate Limit & QoS |  | API Mgmt | |
|  +------------------+  +------------------+  +------------------+  +-----------+ |
|  +------------------+  +------------------+  +------------------+              |
|  | Session Manager  |  | Context Broker   |  | Tool Registry    |              |
|  +------------------+  +------------------+  +------------------+              |
+----------------------------------------------------------------------------------+
                                       |
                                       v
+----------------------------------------------------------------------------------+
|                              AI AGENT FRAMEWORK (Rust)                           |
|                                                                                  |
|   +--------------------+     +--------------------+     +--------------------+   |
|   |       TOOLS        |     |       SKILLS       |     |      MEMORY        |   |
|   | (exec, file, db)   |     | (domain modules)   |     | (short/long term)   |   |
|   +--------------------+     +--------------------+     +--------------------+   |
|                                                                                  |
|   +--------------------+     +--------------------+     +--------------------+   |
|   |      CONTEXT       |     |   OBSERVABILITY    |     |        LLM         |   |
|   | (state & buffers)  |     | (logs/metrics)     |     | (local/service)    |   |
|   +--------------------+     +--------------------+     +--------------------+   |
|                                                                                  |
|                         +------------------------------+                         |
|                         |          AGENT LOOP          |                         |
|                         |  Plan -> Act -> Observe ->   |                         |
|                         |  Reflect -> Update Context   |                         |
|                         +------------------------------+                         |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

## Key Components

### 1. UI / Client Layer

All client applications act as thin UI interaction layers:

- **Desktop**: macOS, Linux, Windows native applications
- **Mobile**: iOS and Android apps
- **Web**: Browser-based interface
- **CLI**: Terminal/command-line interface
- **IM Bots**: Feishu, Telegram, Slack, WhatsApp, Discord integrations
- **Other SDKs**: Third-party integrations

### 2. Deployment Modes

The Agent Gateway supports dual deployment modes:

- **Local Mode**: Gateway runs on the user's device, providing offline capabilities and data privacy
- **Service Mode**: Gateway runs in the cloud, offering scalable compute and centralized management

### 3. Agent Gateway

The unified entry point for all client interactions:

| Component | Description |
|-----------|-------------|
| Auth & Tenancy | Authentication and multi-tenant isolation |
| Routing & Policy | Request routing and policy enforcement |
| Rate Limit & QoS | Traffic control and quality of service |
| API Management | API versioning and documentation |
| Session Manager | User session lifecycle management |
| Context Broker | Context propagation between components |
| Tool Registry | Tool discovery and metadata management |

### 4. AI Agent Framework (Rust)

The core Agent runtime implemented in Rust, featuring:

#### Core Components

| Component | Description |
|-----------|-------------|
| **Tools** | Execution environment for file, database, and system operations |
| **Skills** | Domain-specific capability modules |
| **Memory** | Short-term and long-term memory storage |
| **Context** | State management and buffer handling |
| **Observability** | Logging, metrics, and tracing infrastructure |
| **LLM** | Local and cloud-based language model integration |

#### Agent Loop

The central execution cycle:

```
Plan -> Act -> Observe -> Reflect -> Update Context
```

This loop enables the Agent to:
1. **Plan**: Analyze user intent and formulate execution strategy
2. **Act**: Execute tools and invoke skills
3. **Observe**: Monitor execution results and environment changes
4. **Reflect**: Evaluate outcomes and adjust strategy
5. **Update Context**: Persist learnings and maintain conversation state

## Design Principles

1. **Unified Interface**: All clients interact through a single, consistent API
2. **Deployment Flexibility**: Support both local (edge) and service (cloud) deployments
3. **Capability Parity**: Core Agent functionality available across all deployment modes
4. **Observability First**: Comprehensive tracing and monitoring built-in
5. **Extensible Architecture**: Plugin-based tool and skill system
