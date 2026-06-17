import { z } from "zod";
import { badRequest } from "@/lib/http/errors";

const loginBodySchema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
});

export type LoginInput = {
  email: string;
  senha: string;
};

export const loginSchema = loginBodySchema;

export function normalizeLoginInput(body: z.infer<typeof loginBodySchema>): LoginInput {
  const senha = body.senha ?? body.password;
  if (!senha) throw badRequest("Senha obrigatória");
  return { email: body.email, senha };
}

export const forgotPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(32, "Token inválido"),
  novaSenha: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
  confirmarSenha: z.string().min(6).optional(),
}).refine(
  (data) => !data.confirmarSenha || data.novaSenha === data.confirmarSenha,
  { message: "As senhas não coincidem", path: ["confirmarSenha"] },
);

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
