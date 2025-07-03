#!/usr/bin/env bun

import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";

yargs(hideBin(Bun.argv))
  .command("greet <name>", "Greet a user", {}, (argv) => {
    console.log(`Hello, ${argv.name}!`);
  })
  .demandCommand()
  .help()
  .parse();
