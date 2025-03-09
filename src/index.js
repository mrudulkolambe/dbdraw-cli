#!/usr/bin/env node

import { Command } from 'commander';
import { commands } from './commands/index.js';

const program = new Command();

program
  .name('dbdraw')
  .description('DBDraw CLI for authentication and database operations')
  .version('1.0.1');

// Register all commands
for (const command of commands) {
  const cmd = program.command(command.name);
  cmd.description(command.description);
  cmd.action(command.action);
}

program.parse(process.argv);
