import { afterEach, describe, expect, test } from "bun:test"
import { Hono } from "hono"

import { masterKeyAuth } from "~/middleware/master-key"

const PATH_RESPONSES = "/v1/responses"
const PATH_ANTHROPIC = "/v1/messages"

afterEach(() => {
  delete process.env.MASTER_KEY
})

describe("masterKeyAuth middleware", () => {
  test("allows requests when MASTER_KEY is unset", async () => {
    delete process.env.MASTER_KEY
    const app = new Hono()
    app.use(masterKeyAuth())
    app.get(PATH_RESPONSES, (c) => c.text("ok"))

    const res = await app.request(PATH_RESPONSES)

    expect(res.status).toBe(200)
    expect(await res.text()).toBe("ok")
  })

  test("blocks requests without Authorization header when MASTER_KEY is set", async () => {
    process.env.MASTER_KEY = "secret"
    const app = new Hono()
    app.use(masterKeyAuth())
    app.get(PATH_RESPONSES, (c) => c.text("ok"))

    const res = await app.request(PATH_RESPONSES)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({
      error: {
        message: "Invalid or missing Authorization header",
        type: "invalid_api_key",
      },
    })
  })

  test("returns Anthropic-style error for /v1/messages", async () => {
    process.env.MASTER_KEY = "secret"
    const app = new Hono()
    app.use(masterKeyAuth())
    app.get(PATH_ANTHROPIC, (c) => c.text("ok"))

    const res = await app.request(PATH_ANTHROPIC, {
      headers: {
        authorization: "Bearer wrong",
      },
    })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({
      type: "error",
      error: {
        type: "authentication_error",
        message: "Invalid or missing Authorization header",
      },
    })
  })

  test("allows requests with matching bearer token", async () => {
    process.env.MASTER_KEY = "secret"
    const app = new Hono()
    app.use(masterKeyAuth())
    app.get(PATH_RESPONSES, (c) => c.text("ok"))

    const res = await app.request(PATH_RESPONSES, {
      headers: {
        authorization: "Bearer secret",
      },
    })

    expect(res.status).toBe(200)
    expect(await res.text()).toBe("ok")
  })
})
