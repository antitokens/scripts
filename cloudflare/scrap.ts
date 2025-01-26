import { Connection, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";

const PROGRAM_ID = "5eR98MdgS8jYpKB2iD9oz3MtBdLJ6s7gAVWJZFMvnL9G";
const RPC_ENDPOINT = "https://api.mainnet-beta.solana.com";

interface Env {
  WORKER_STATE: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env) {
    const id = env.WORKER_STATE.idFromName("event-scraper");
    const obj = env.WORKER_STATE.get(id);
    return obj.fetch(request);
  },
};

export class EventScraper {
  private connection: Connection;
  private cursor: string | null;
  private isRunning: boolean;
  private indexerEndpoint: string;
  private state: DurableObjectState;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.connection = new Connection(RPC_ENDPOINT);
    this.cursor = null;
    this.isRunning = false;
    this.indexerEndpoint = "https://your-indexer.workers.dev";

    // Handle periodic scraping
    state.blockConcurrencyWhile(async () => {
      const storedCursor = await state.storage.get("cursor");
      if (storedCursor) this.cursor = String(storedCursor);
    });
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    switch (url.pathname) {
      case "/start":
        if (!this.isRunning) {
          this.isRunning = true;
          this.startScraping();
          return new Response("Scraping started");
        }
        return new Response("Already running");

      case "/stop":
        this.isRunning = false;
        return new Response("Scraping stopped");

      case "/status":
        return new Response(
          JSON.stringify({
            isRunning: this.isRunning,
            cursor: this.cursor,
          })
        );

      default:
        return new Response("Not found", { status: 404 });
    }
  }

  private async startScraping() {
    while (this.isRunning) {
      try {
        const signatures = await this.connection.getSignaturesForAddress(
          new PublicKey(PROGRAM_ID),
          { limit: 100, before: this.cursor || undefined }
        );

        if (signatures.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10000));
          continue;
        }

        for (const sig of signatures) {
          const tx = await this.connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (!tx?.meta?.logMessages) continue;

          const events = this.parseEvents(tx.meta.logMessages);

          for (const event of events) {
            await fetch(this.indexerEndpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-signature": sig.signature,
              },
              body: JSON.stringify(event),
            });
          }
        }

        this.cursor = signatures[signatures.length - 1].signature;
        await this.state.storage.put("cursor", this.cursor);
      } catch (error) {
        console.error("Scraping error:", error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private parseEvents(logs: string[]): any[] {
    const events = [];

    for (const log of logs) {
      if (!log.includes("Program log:")) continue;

      try {
        if (log.includes("PollCreatedEvent")) {
          events.push(this.parsePollCreatedEvent(log));
        } else if (log.includes("DepositEvent")) {
          events.push(this.parseDepositEvent(log));
        } else if (log.includes("EqualisationEvent")) {
          events.push(this.parseEqualisationEvent(log));
        } else if (log.includes("WithdrawEvent")) {
          events.push(this.parseWithdrawEvent(log));
        }
      } catch (e) {
        console.error("Failed to parse event:", e);
      }
    }

    return events;
  }

  private parsePollCreatedEvent(log: string) {
    const regex = /PollCreatedEvent:\s*{([^}]+)}/;
    const match = log.match(regex);
    if (!match) throw new Error("Invalid PollCreatedEvent format");

    const pairs = match[1].split(",").map((pair) => pair.trim());
    const event: any = { name: "PollCreatedEvent", data: {} };

    for (const pair of pairs) {
      const [key, value] = pair.split(":").map((s) => s.trim());
      switch (key) {
        case "poll_index":
          event.data.poll_index = parseInt(value);
          break;
        case "creator":
          event.data.creator = new PublicKey(value);
          break;
        case "title":
          event.data.title = value.replace(/^"|"$/g, "");
          break;
        case "start_time":
        case "end_time":
          event.data[key] = value.replace(/^"|"$/g, "");
          break;
        case "timestamp":
          event.data.timestamp = parseInt(value);
          break;
      }
    }

    return event;
  }

  private parseDepositEvent(log: string) {
    const regex = /DepositEvent:\s*{([^}]+)}/;
    const match = log.match(regex);
    if (!match) throw new Error("Invalid DepositEvent format");

    const pairs = match[1].split(",").map((pair) => pair.trim());
    const event: any = { name: "DepositEvent", data: {} };

    for (const pair of pairs) {
      const [key, value] = pair.split(":").map((s) => s.trim());
      switch (key) {
        case "poll_index":
          event.data.poll_index = parseInt(value);
          break;
        case "depositor":
          event.data.depositor = new PublicKey(value);
          break;
        case "anti_amount":
        case "pro_amount":
        case "u_value":
        case "s_value":
          event.data[key] = parseInt(value);
          break;
        case "timestamp":
          event.data.timestamp = parseInt(value);
          break;
      }
    }

    return event;
  }

  private parseEqualisationEvent(log: string) {
    const regex = /EqualisationEvent:\s*{([^}]+)}/;
    const match = log.match(regex);
    if (!match) throw new Error("Invalid EqualisationEvent format");

    const pairs = match[1].split(",").map((pair) => pair.trim());
    const event: any = { name: "EqualisationEvent", data: {} };

    for (const pair of pairs) {
      const [key, value] = pair.split(":").map((s) => s.trim());
      switch (key) {
        case "poll_index":
          event.data.poll_index = parseInt(value);
          break;
        case "truth_values":
          event.data.truth_values = value
            .replace(/[\[\]]/g, "") // Remove brackets
            .split(",") // Split into strings
            .map((v) => parseInt(v.trim())); // Convert each to number
          break;
        case "total_anti":
        case "total_pro":
          event.data[key] = parseInt(value);
          break;
        case "timestamp":
          event.data.timestamp = parseInt(value);
          break;
      }
    }

    return event;
  }

  private parseWithdrawEvent(log: string) {
    const regex = /WithdrawEvent:\s*{([^}]+)}/;
    const match = log.match(regex);
    if (!match) throw new Error("Invalid WithdrawEvent format");

    const pairs = match[1].split(",").map((pair) => pair.trim());
    const event: any = { name: "WithdrawEvent", data: {} };

    for (const pair of pairs) {
      const [key, value] = pair.split(":").map((s) => s.trim());
      switch (key) {
        case "poll_index":
          event.data.poll_index = parseInt(value);
          break;
        case "user":
          event.data.user = new PublicKey(value);
          break;
        case "anti_amount":
        case "pro_amount":
          event.data[key] = parseInt(value);
          break;
        case "timestamp":
          event.data.timestamp = parseInt(value);
          break;
      }
    }

    return event;
  }
}
