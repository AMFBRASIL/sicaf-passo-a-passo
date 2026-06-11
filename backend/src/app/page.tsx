export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 640 }}>
      <h1>CADBRASIL Backend v2</h1>
      <p>API REST em Next.js — use os endpoints em <code>/api/v1/*</code></p>
      <ul>
        <li>
          <a href="/api/v1/health">GET /api/v1/health</a>
        </li>
        <li>POST /api/v1/auth/login</li>
        <li>GET /api/v1/auth/me</li>
        <li>GET /api/v1/clientes</li>
        <li>POST /api/cron/&#123;jobName&#125;</li>
      </ul>
    </main>
  );
}
