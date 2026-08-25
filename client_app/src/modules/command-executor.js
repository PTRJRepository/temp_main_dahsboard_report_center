'use strict';

/**
 * Routes a control command to the first handler whose canHandle() matches,
 * port of CommandExecutor.cs. Never throws: failures become Failed results.
 */
export class CommandExecutor {
  constructor(handlers) {
    this.handlers = handlers;
  }

  async execute(command) {
    try {
      if (!command?.commandType) {
        return { success: false, message: 'Invalid command: commandType is required.' };
      }
      const handler = this.handlers.find(handler => handler.canHandle(command));
      if (!handler) {
        return { success: false, message: `Unsupported command '${command.commandType}'.` };
      }
      return await handler.handle(command);
    } catch (err) {
      return { success: false, message: err?.message ?? String(err) };
    }
  }
}
