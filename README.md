# DBDraw CLI

A CLI tool to seamlessly generate and manage MongoDB schemas in Node.js using visual database designs created on [DBDraw](https://dbdraw.vercel.app).

## Overview

The **DBDraw CLI** bridges the gap between database visualization and backend development. With this tool, you can:
- Design your database schema visually on [DBDraw](https://dbdraw.vercel.app), where nodes represent collections and edges define relationships.
- Sync the schemas directly into your local project with just a few commands.
- Save development time and ensure your database structure stays consistent and maintainable.

---

## Installation

Install the DBDraw CLI globally using npm:

```bash
npm install -g dbdraw
```

## Project Structure

The DBDraw CLI is organized with a modular architecture:

```
dbdraw-cli/
├── src/                    # Source code directory
│   ├── commands/           # CLI command definitions
│   │   ├── login.js        # Login command implementation
│   │   ├── link.js         # Link command implementation
│   │   ├── sync.js         # Sync command implementation
│   │   └── index.js        # Command exports
│   ├── services/           # Core service modules
│   │   ├── auth.js         # Authentication service
│   │   ├── project.js      # Project management service
│   │   └── schema.js       # Schema generation service
│   ├── utils/              # Utility functions
│   │   └── constants.js    # Shared constants
│   └── index.js            # Main entry point
└── package.json            # Project configuration
```

## Features

- **Visual Database Design**  
  Design your database structure visually using [DBDraw](https://dbdraw.vercel.app), where:
  - **Nodes** represent collections.
  - **Edges** represent relationships between collections.

- **Schema Generation**  
  Automatically generate MongoDB schemas from your DBDraw designs, saving time and reducing manual errors.

- **TypeScript Support**  
  Choose between JavaScript or TypeScript schema generation for improved type safety and code quality.

- **Custom Configuration**  
  Configure options such as:
  - Module system: CommonJS or ESM.
  - Output directory for generated models.

- **Synchronization**  
  Keep your local schemas updated with the latest changes made on [DBDraw](https://dbdraw.vercel.app) using the `sync` command.



# Getting Started

## Step 1: Create a Database Design
1. Visit [DBDraw](https://dbdraw.vercel.app) and sign up or log in to your account.
2. Start a new design:
   - Add **nodes** to represent collections.
   - Use **edges** to define relationships between collections.
3. Save your design for future use.


## Step 2: Generate an Access Token
1. Navigate to the **Settings** section in your DBDraw account.
2. Generate a new **Access Token**.
3. Copy the token for authentication in the CLI.

## Step 3: Log In to the CLI
Authenticate yourself by pasting the access token into the CLI when prompted.

```bash
dbdraw login
```

## Step 4: Link Your Project
Select a project from your DBDraw account and link it to your local Node.js project.

```bash
dbdraw link
```


## Step 5: Configure Project Settings
After linking, set up the following configurations for your project:
- Select the module system (e.g., CommonJS or ESM).
- Choose the language (TypeScript or JavaScript).
- Define the path where the schemas should be generated.


## Step 6: Sync Your Schemas
Once everything is configured, sync your local project to download the schemas generated from your DBDraw design.

```bash
dbdraw sync