import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// ISR/cache binding ছাড়া (dummy cache) — Workers Free-তে চলা P0a-তে যাচাই হবে
export default defineCloudflareConfig();
