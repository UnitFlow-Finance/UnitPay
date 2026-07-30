import "server-only";

export class ApiRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRouteError";
    this.status = status;
  }
}

export function badRequest(message: string): ApiRouteError {
  return new ApiRouteError(400, message);
}
