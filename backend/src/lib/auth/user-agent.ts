export function parseUserAgent(ua: string | null | undefined) {
  if (!ua) {
    return { dispositivo: "Desconhecido", navegador: "Desconhecido", plataforma: "Desconhecido" };
  }

  let plataforma = "Outro";
  if (/windows/i.test(ua)) plataforma = "Windows";
  else if (/macintosh|mac os/i.test(ua)) plataforma = "macOS";
  else if (/android/i.test(ua)) plataforma = "Android";
  else if (/iphone|ipad/i.test(ua)) plataforma = "iOS";
  else if (/linux/i.test(ua)) plataforma = "Linux";

  let dispositivo = "Desktop";
  if (/mobile|android|iphone/i.test(ua)) dispositivo = "Mobile";
  else if (/tablet|ipad/i.test(ua)) dispositivo = "Tablet";

  let navegador = "Outro";
  if (/edg\//i.test(ua)) navegador = "Edge";
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) navegador = "Chrome";
  else if (/firefox\//i.test(ua)) navegador = "Firefox";
  else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) navegador = "Safari";
  else if (/opera|opr\//i.test(ua)) navegador = "Opera";

  return { dispositivo, navegador, plataforma };
}
