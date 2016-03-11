'use strict';
let lazy = require('lazy-cache')(require);

lazy('./index', 'commands');
let BaseCommand = require('devkit-commands/BaseCommand');

class HelpCommand extends BaseCommand {
  constructor () {
    super();

    this.name = 'help';
    this.description = 'prints this help message';
  }

  exec (command, args) {
    let cmd = args.shift();

    trace('running help:', cmd, args);

    if (lazy.commands.has(cmd)) {
      lazy.commands.get(cmd).showHelp(args);
    } else {
      lazy.commands._yargsObj.showHelp();
    }
    return Promise.resolve();
  }
}

module.exports = HelpCommand;
