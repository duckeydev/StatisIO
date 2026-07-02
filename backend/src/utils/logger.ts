/**
 * Logger class for logging messages with different levels (log, error, warn).
 * Each log entry includes a timestamp and the service name.
 * I over-engineered this lmao
 * Certified Human-made™
 * @info https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797 || This was so helpful for me to understand how to implement bare ANSI coloring
 */

export default class Logger {
  private serviceName: string;
  private readonly LEVEL_PADDING = 7;

  private readonly colors = {
    reset: "\x1b[0m",
    blue: "\x1b[34m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    gray: "\x1b[90m",
    bold: "\x1b[1m",
    grayBold: "\x1b[1;90m",
  };

  constructor(serviceName: string = "SYSTEM") {
    this.serviceName = serviceName;
  }

  private getTimestamp(): string {
    return `${this.colors.gray}${new Date().toLocaleTimeString()}${this.colors.reset}`;
  }

  private formatLevel(level: string, color: string): string {
    const coloredLevel = `${color}${level}${this.colors.reset}`;
    return coloredLevel.padEnd(this.LEVEL_PADDING + (coloredLevel.length - level.length));
  }

  log(message: string): void {
    console.log(
      `${this.colors.grayBold}${this.getTimestamp()} >${this.colors.reset} ${this.formatLevel("[INFO]", this.colors.blue)}` +
      `${this.colors.bold}[${this.serviceName}]${this.colors.reset}: ${message}`
    );
  }

  error(message: string): void {
    console.error(
      `${this.colors.grayBold}${this.getTimestamp()} >${this.colors.reset} ${this.formatLevel("[ERROR]", this.colors.red)}` +
      `${this.colors.bold}[${this.serviceName}]${this.colors.reset}: ${message}`
    );
  }

  warn(message: string): void {
    console.warn(
      `${this.colors.grayBold}${this.getTimestamp()} >${this.colors.reset} ${this.formatLevel("[WARN]", this.colors.yellow)}` +
      `${this.colors.bold}[${this.serviceName}]${this.colors.reset}: ${message}`
    );
  }
}