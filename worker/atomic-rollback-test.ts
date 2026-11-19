interface Env { DB: D1Database }
export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    const band = await env.DB.prepare(
      "SELECT status FROM wristband_inventory WHERE serial='ACC002'"
    ).first<{status:string}>()
    if (!band || band.status !== 'Available') {
      return Response.json({error:'ACC002 is not Available; test not run',currentStatus:band?.status ?? null},{status:409})
    }
    try {
      await env.DB.batch([
        env.DB.prepare("UPDATE wristband_inventory SET status='Revoked' WHERE serial='ACC002' AND status='Available'"),
        env.DB.prepare("INSERT INTO wristband_inventory_audit (id,wristband_id,serial,action,performed_by) VALUES (?,?,?,?,?)")
          .bind('TEST-ROLLBACK-ATOMIC','INVALID-BAND-ID','ACC002','ASSIGNED','b5a3cd3e-696c-43ac-a9ab-733655c690af')
      ])
      return Response.json({error:'Expected constraint failure did not occur'})
    } catch (error) {
      const after = await env.DB.prepare(
        "SELECT status FROM wristband_inventory WHERE serial='ACC002'"
      ).first<{status:string}>()
      return Response.json({
        batchFailed: true,
        error: error instanceof Error ? error.message : 'Database error',
        statusAfterFailure: after?.status,
        rollbackVerified: after?.status === 'Available'
      })
    }
  }
}