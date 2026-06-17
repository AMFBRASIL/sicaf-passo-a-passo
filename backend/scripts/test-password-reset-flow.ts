/**
 * Teste ponta a ponta: token de recuperação → redefinição de senha.
 * Uso: npx tsx scripts/test-password-reset-flow.ts [email]
 */
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env"), override: true });

async function main() {
  const email = process.argv[2];
  let targetEmail = email;

  const { authRepository, generatePasswordResetToken, hashPasswordResetToken } = await import(
    "../src/modules/auth/auth.repository"
  );
  const { getWritePool } = await import("../src/lib/db/mysql");

  if (!targetEmail) {
    const pool = getWritePool();
    const [rows] = await pool.query<Array<{ email: string }>>(
      `SELECT email FROM usuarios WHERE status = 'Ativo' AND deleted_at IS NULL LIMIT 1`,
    );
    targetEmail = rows[0]?.email;
    if (!targetEmail) {
      console.error("Nenhum usuário ativo encontrado para teste.");
      process.exit(1);
    }
    console.log("Usando primeiro usuário ativo:", targetEmail);
  }

  const { authService } = await import("../src/modules/auth/auth.service");
  const { verifyPassword } = await import("../src/lib/auth/password");
  const { buildPasswordResetUrl } = await import("../src/modules/auth/password-reset-email");

  const usuario = await authRepository.findByEmail(targetEmail);
  if (!usuario) {
    console.error("Usuário não encontrado:", targetEmail);
    process.exit(1);
  }

  console.log("Usuário:", usuario.id, usuario.nome, usuario.status);

  const plainToken = generatePasswordResetToken();
  const tokenHash = hashPasswordResetToken(plainToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await authRepository.createPasswordResetToken(usuario.id, tokenHash, expiresAt, "127.0.0.1");

  const resetUrl = buildPasswordResetUrl(plainToken);
  console.log("URL do e-mail:", resetUrl);

  const found = await authRepository.findValidPasswordResetToken(tokenHash);
  console.log("Token válido no banco:", found ? "sim" : "não");

  const testPassword = `Teste@${Date.now().toString().slice(-6)}`;
  const result = await authService.resetPasswordWithToken({
    token: plainToken,
    novaSenha: testPassword,
    confirmarSenha: testPassword,
  });

  console.log("Reset resultado:", result);

  const updated = await authRepository.findById(usuario.id);
  const senhaOk = updated ? await verifyPassword(testPassword, updated.senha_hash) : false;
  console.log("Nova senha verificada no banco:", senhaOk ? "sim" : "não");

  const reused = await authService.resetPasswordWithToken({
    token: plainToken,
    novaSenha: testPassword,
    confirmarSenha: testPassword,
  });
  console.log("Reuso do token (deve falhar):", reused);

  process.exit(senhaOk && result.ok && !reused.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
