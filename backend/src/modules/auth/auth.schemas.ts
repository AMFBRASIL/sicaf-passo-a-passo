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
