import chalk from "chalk";
import logSymbols from "log-symbols";

export type LogLevel = "info" | "warn" | "error" | "success" | "debug";

export class Logger {
  private static instance: Logger;
  private debugMode: boolean = false;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const prefix = this.getPrefix(level);
    return `${prefix} ${message}`;
  }

  private getPrefix(level: LogLevel): string {
    switch (level) {
      case "info":
        return chalk.blue(logSymbols.info);
      case "warn":
        return chalk.yellow(logSymbols.warning);
      case "error":
        return chalk.red(logSymbols.error);
      case "success":
        return chalk.green(logSymbols.success);
      case "debug":
        return chalk.gray("⚙️");
      default:
        return "";
    }
  }

  info(message: string): void {
    console.log(this.formatMessage("info", message));
  }

  warn(message: string): void {
    console.log(this.formatMessage("warn", message));
  }

  error(message: string): void {
    console.error(this.formatMessage("error", message));
  }

  success(message: string): void {
    console.log(this.formatMessage("success", message));
  }

  debug(message: string): void {
    if (this.debugMode) {
      console.log(this.formatMessage("debug", message));
    }
  }

  // Special formatting for scanning operations
  scanStart(configPath: string): void {
    console.log(chalk.bold(`Scanning "${configPath}"`));
  }

  scanNoServers(configPath: string): void {
    this.warn(`No MCP servers found in ${configPath}`);
  }

  scanError(configPath: string, error: string): void {
    this.error(`Error scanning ${configPath}: ${error}`);
  }

  scanConfigNotFound(configPath: string): void {
    this.error(`Config file "${configPath}" does not exist`);
  }

  // Special formatting for vulnerabilities
  vulnerabilitiesFound(configPath: string, count: number): void {
    console.log(
      `\n${chalk.yellow("⚠️  Vulnerabilities Detected in")} ${chalk.bold(configPath)}\n`,
    );
  }
}

// Export a singleton instance
export const logger = Logger.getInstance();
