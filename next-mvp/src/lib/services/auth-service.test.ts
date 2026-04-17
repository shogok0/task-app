import { beforeEach, describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { loginUser, registerUser } from "@/lib/services/auth-service";
import { resetDb } from "@/test/db-utils";

describe("auth service", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("registers and logs in a user", async () => {
    const user = await registerUser({
      displayName: "Taro",
      email: "taro@example.com",
      password: "password123",
    });

    const logged = await loginUser({
      email: "taro@example.com",
      password: "password123",
    });

    expect(user.email).toBe("taro@example.com");
    expect(logged.id).toBe(user.id);
  });

  it("throws conflict on duplicate email", async () => {
    await registerUser({
      displayName: "Taro",
      email: "taro@example.com",
      password: "password123",
    });

    await expect(
      registerUser({
        displayName: "Hanako",
        email: "taro@example.com",
        password: "password123",
      }),
    ).rejects.toMatchObject<AppError>({ code: "EMAIL_CONFLICT" });
  });
});
