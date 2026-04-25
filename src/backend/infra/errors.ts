export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string): HttpError => new HttpError(400, message);
export const unauthorized = (message: string): HttpError => new HttpError(401, message);
export const forbidden = (message: string): HttpError => new HttpError(403, message);
export const notFound = (message: string): HttpError => new HttpError(404, message);
export const conflict = (message: string): HttpError => new HttpError(409, message);
export const unprocessableEntity = (message: string): HttpError => new HttpError(422, message);
export const serviceUnavailable = (message: string): HttpError => new HttpError(503, message);
export const badGateway = (message: string): HttpError => new HttpError(502, message);

export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof Error) return new HttpError(500, error.message);
  return new HttpError(500, "Unknown server error");
}
