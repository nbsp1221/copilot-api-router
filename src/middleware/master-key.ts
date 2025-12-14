import type { MiddlewareHandler } from "hono"

const AUTH_HEADER = "authorization"
const BEARER_PREFIX = "bearer "

export function masterKeyAuth(): MiddlewareHandler {
  const configuredKey = (process.env.MASTER_KEY ?? "").trim()

  if (!configuredKey) {
    return async (_c, next) => next()
  }

  return async (c, next) => {
    const headerValue = c.req.header(AUTH_HEADER) ?? ""
    const candidate =
      headerValue.toLowerCase().startsWith(BEARER_PREFIX) ?
        headerValue.slice(BEARER_PREFIX.length).trim()
      : undefined

    if (candidate !== configuredKey) {
      const path = c.req.path

      if (path.startsWith("/v1/messages")) {
        return c.json(
          {
            type: "error",
            error: {
              type: "authentication_error",
              message: "Invalid or missing Authorization header",
            },
          },
          401,
        )
      }

      return c.json(
        {
          error: {
            message: "Invalid or missing Authorization header",
            type: "invalid_api_key",
          },
        },
        401,
      )
    }

    await next()
  }
}
