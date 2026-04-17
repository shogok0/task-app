import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { loginSchema, registerSchema } from "@/lib/validation";

type RegisterInput = {
  displayName: string;
  email: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

export async function registerUser(input: RegisterInput) {
  const parsed = registerSchema.parse(input);

  const existing = await db.user.findUnique({
    where: { email: parsed.email },
    select: { id: true },
  });

  if (existing) {
    throw new AppError("このメールアドレスは既に登録されています。", 409, "EMAIL_CONFLICT");
  }

  const passwordHash = await bcrypt.hash(parsed.password, 10);

  const user = await db.user.create({
    data: {
      displayName: parsed.displayName,
      email: parsed.email,
      passwordHash,
      notificationSetting: {
        create: {
          emailEnabled: false,
          remindBeforeDays: 1,
          pushEnabled: false,
        },
      },
    },
  });

  return user;
}

export async function loginUser(input: LoginInput) {
  const parsed = loginSchema.parse(input);

  const user = await db.user.findUnique({
    where: { email: parsed.email },
  });

  if (!user) {
    throw new AppError("メールアドレスまたはパスワードが正しくありません。", 401, "INVALID_CREDENTIALS");
  }

  const isValid = await bcrypt.compare(parsed.password, user.passwordHash);
  if (!isValid) {
    throw new AppError("メールアドレスまたはパスワードが正しくありません。", 401, "INVALID_CREDENTIALS");
  }

  return user;
}
