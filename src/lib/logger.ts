// structured logging (Workers Logs-এ JSON লাইন); third-party error-SDK নেই; stack trace ইউজারকে দেখানো হয় না
export type LogLevel = "debug" | "info" | "warn" | "error";
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

type Sink = (line: string) => void;

export function createLogger(minLevel: LogLevel = "info", sink: Sink = (l) => console.log(l)) {
  const log = (level: LogLevel, msg: string, ctx?: Record<string, unknown>) => {
    if (ORDER[level] < ORDER[minLevel]) return;
    sink(JSON.stringify({ level, msg, ...ctx, ts: new Date().toISOString() }));
  };
  return {
    debug: (m: string, c?: Record<string, unknown>) => log("debug", m, c),
    info: (m: string, c?: Record<string, unknown>) => log("info", m, c),
    warn: (m: string, c?: Record<string, unknown>) => log("warn", m, c),
    error: (m: string, c?: Record<string, unknown>) => log("error", m, c),
  };
}
