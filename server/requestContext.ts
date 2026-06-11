import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContext = {
  userId: string | null;
};

const requestContext = new AsyncLocalStorage<RequestContext>();
let fallbackUserId: string | null = null;

export function runWithRequestContext<T>(context: RequestContext, callback: () => T) {
  return requestContext.run(context, callback);
}

export function enterRequestContext(context: RequestContext) {
  fallbackUserId = context.userId;
  requestContext.enterWith(context);
}

export function getRequestUserId() {
  return requestContext.getStore()?.userId ?? fallbackUserId;
}
