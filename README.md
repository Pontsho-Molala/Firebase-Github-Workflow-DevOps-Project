# Firebase + GitHub Actions DevOps Project

## Overview

This repository contains a Firebase web application configured with a GitHub Actions workflow for continuous integration and deployment. The workflow builds and deploys the project automatically when changes are pushed to the main branch.


## Structure

```shell
  [ Developer Push / PR ]
             │
             ▼
     [ GitHub Actions ] ──( Reads Secret JSON )──► [ Google Cloud IAM ]
             │                                             │
      ( Builds Node 24 )                               ( Authorises )
             │                                             │
             ▼                                             ▼
[ Firebase Hosting CDN Edge ] ◄────────────────────────────┘
     ├── Pull Request ──► Ephemeral Preview Channels
     └── Main Branch   ──► Live Production Domain
```


## Key DevOps Principles Displayed

- Infrastructure Isolation: Complete detachment between the development database/hosting instances and production targets.
- Atomic Zero-Downtime Deploys: Deployments shift CDN routing pointers instantly at the edge network to eliminate active user downtime.
- Least Privilege Access Control: Replaced general personal token access with precise Google Cloud IAM Service Account definitions.
- Pull Request Preview Environments: Automates live, temporary site reviews before code reviews are merged.

## Technologies

- Firebase Hosting
- Firebase CLI
- GitHub Actions
- Node.js
- npm
- HTML / CSS / JavaScript (or your web framework)


## Technologies Used
* **Cloud Platform**: [Firebase (Google Cloud Platform)](https://google.com)
* **CI/CD Orchestration**: [GitHub Actions](https://github.com)
* **Environment Execution Engine**: Node.js v24 (Latest LTS)
* **Authentication Infrastructure**: Google Cloud IAM Service Accounts (JSON Configuration)
* **Frontend Technologies**: HTML5, Vanilla JavaScript, CSS3 (DevOps Metrics UI)

## Step-by-Step Implementation Ledger

### 1. Isolated Cloud Infrastructure Provisioning
Two separate projects were generated inside the [Firebase Console](https://google.com) to isolate environments:
* Staging Project: "dev-env": "my-devops-portfolio-dev-2880d"
* Production Project: "prod-env": "my-devops-portfolio-prod-f1adf"

### 2. Eliminating Deprecated Tokens for Cloud IAM Service Keys
The legacy `firebase --token` methodology has been deprecated due to security vulnerabilities involving long-lived credentials. To replace it:
1. Navigated to **Google Cloud Console ➔ IAM & Admin ➔ Service Accounts**.
2. Generated a dedicated Service Account named `github-actions-delivery`.
3. Bound the required least-privilege roles to the account: `Firebase Hosting Admin` and `API Keys Viewer`.
4. Exported a fresh, secure **JSON Private Key** for the Service Account.

### 3. Securing GitHub Repository Vaults
To safely pass authentication data to the runners:
1. Opened the **GitHub Repository ➔ Settings ➔ Secrets and Variables ➔ Actions**.
2. Formed a new Repository Secret named `FIREBASE_SERVICE_ACCOUNT_JSON`.
3. Pasted the raw, entire contents of the Google Cloud Service Account JSON file directly into the vault.

### 4. Codebase Multi-Target Workspace Structure
The project configuration maps environment aliases deterministically using `.firebaserc` and configures caching layers through `firebase.json`:

#### `.firebaserc`
```json
{
  "projects": {
    "dev-env": "my-devops-portfolio-dev-2880d",
    "prod-env": "my-devops-portfolio-prod-f1adf"
  }
}
```

#### `firebase.json`
```json
{
  "hosting": {
    "public": "public",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{
      "source": "**",
      "destination": "/index.html"
    }]
  }
}
```

### 5. Multi-Track Automation Workflow Integration
Two distinct pipeline configuration scripts were mounted into the `.github/workflows/` repository matrix:

#### Track A: Staging & Preview Delivery (`staging-preview.yml`)
Fires when a branch opens a Pull Request. It installs Node 24, processes the secret service JSON