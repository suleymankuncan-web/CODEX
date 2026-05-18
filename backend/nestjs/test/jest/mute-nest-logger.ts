import { Logger } from "@nestjs/common";

type NestLoggerLevel = "error" | "log" | "warn";

export function muteNestLogger(levels: NestLoggerLevel[]) {
  const spies = levels.map((level) =>
    jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined),
  );

  return () => {
    for (const spy of spies) {
      spy.mockRestore();
    }
  };
}
