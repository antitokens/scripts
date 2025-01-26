interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const event = await request.json();
    const signature = request.headers.get('x-signature');
    
    if (!signature || !verifySignature(event, signature)) {
      return new Response('Invalid signature', { status: 401 });
    }

    try {
      switch(event.name) {
        case 'PollCreatedEvent':
          await env.DB.prepare(`
            INSERT INTO polls (
              poll_index, creator, title, start_time, end_time, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            event.data.poll_index,
            event.data.creator.toBase58(),
            event.data.title,
            event.data.start_time,
            event.data.end_time,
            event.data.timestamp
          ).run();
          break;

        case 'DepositEvent':
          await env.DB.prepare(`
            INSERT INTO deposits (
              poll_index, depositor, anti_amount, pro_amount,
              u_value, s_value, deposited_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            event.data.poll_index,
            event.data.depositor.toBase58(),
            event.data.anti_amount,
            event.data.pro_amount,
            event.data.u_value,
            event.data.s_value,
            event.data.timestamp
          ).run();
          break;

        case 'EqualisationEvent':
          await env.DB.prepare(`
            INSERT INTO equalisations (
              poll_index, truth_values, total_anti,
              total_pro, equalised_at
            ) VALUES (?, ?, ?, ?, ?)
          `).bind(
            event.data.poll_index,
            JSON.stringify(event.data.truth_values),
            event.data.total_anti,
            event.data.total_pro,
            event.data.timestamp
          ).run();
          break;

        case 'WithdrawEvent':
          await env.DB.prepare(`
            INSERT INTO withdrawals (
              poll_index, user_address, anti_amount,
              pro_amount, withdrawn_at  
            ) VALUES (?, ?, ?, ?, ?)
          `).bind(
            event.data.poll_index,
            event.data.user.toBase58(),
            event.data.anti_amount,
            event.data.pro_amount,
            event.data.timestamp
          ).run();
          break;

        default:
          return new Response('Unknown event type', { status: 400 });
      }

      return new Response('Event indexed', { status: 200 });

    } catch (error) {
      return new Response('Error indexing event: ' + error.message, { status: 500 });
    }
  }
};

function verifySignature(event: any, signature: string): boolean {
  // Implement signature verification
  return true;
}
