/** Liveness probe for the container / load balancer. Excluded from the locale proxy. */
export function GET() {
  return Response.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
}
