const ADMIN_EMAIL = Deno.env.get('ADMIN_ALERT_EMAIL') || 'haritabh17@gmail.com'

export async function sendPipelineAlert(processType: string, errorMessage: string): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.log('⚠️ RESEND_API_KEY not set, skipping pipeline alert')
    return
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PostgreSQL Hackers Digest <digest@postgreshackersdigest.dev>',
        to: [ADMIN_EMAIL],
        subject: `[ALERT] Pipeline failure: ${processType}`,
        html: `
          <h2>Pipeline Alert</h2>
          <p><strong>Process:</strong> ${processType}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>Error:</strong></p>
          <pre style="background:#f3f4f6;padding:12px;border-radius:8px;white-space:pre-wrap;">${errorMessage}</pre>
        `,
      }),
    })

    if (!response.ok) {
      console.error('Failed to send pipeline alert:', await response.text())
    }
  } catch (err) {
    console.error('Pipeline alert error:', err)
  }
}
