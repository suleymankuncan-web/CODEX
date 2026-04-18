import { AsyncLocalStorage } from "node:async_hooks";

type RequestContextState = {
  correlationId: string;
  actorUserId: string | null;
};

export class RequestContextStore {
  private static readonly storage = new AsyncLocalStorage<RequestContextState>();

  static run<T>(context: RequestContextState, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  static get(): RequestContextState | undefined {
    return this.storage.getStore();
  }

  static getCorrelationId(): string | null {
    return this.get()?.correlationId ?? null;
  }

  static setActorUserId(actorUserId: string | null): void {
    const context = this.get();
    if (!context) {
      return;
    }

    context.actorUserId = actorUserId;
  }
}
