#!/usr/bin/env node
import { Command } from 'commander';
import { GEODE_VERSION } from '@geode/engine';
import { registerAnalyzeCommand } from './commands/analyze.js';
import { registerHarvestCommand } from './commands/harvest.js';
import { registerCrystalsCommand } from './commands/crystals.js';
import { registerConfigCommand } from './commands/config.js';

const program = new Command();

program
  .name('geode')
  .description('Auto-topology analysis for codebases')
  .version(GEODE_VERSION);

registerAnalyzeCommand(program);
registerHarvestCommand(program);
registerCrystalsCommand(program);
registerConfigCommand(program);

program.parse(process.argv);
