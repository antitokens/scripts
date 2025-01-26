require('dotenv');
const fetch = require('node-fetch');

const sourceAccountId = '892973ecf5177f94c0bc003d89f498b6';
const sourceNamespaceId = '27907d49fc1b4af2b2a976900317f87e';
const sourceApiToken = process.env.SOURCE_API_KEY;
const destinationAccountId = 'b3562d79a9d4c362302e30e42e77a112';
const destinationNamespaceId = '0aec69714b204ea4912a7d622473ee85';
const destinationApiToken = process.env.DESTINATION_API_KEY;

// Function to list keys
async function listKeys(accountId, namespaceId, apiToken) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys`,
    {
      headers: { Authorization: `Bearer ${apiToken}` },
    }
  );
  const data = await response.json();
  return data.result;
}

// Function to get a key's value
async function getValue(accountId, namespaceId, apiToken, key) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${key}`,
    {
      headers: { Authorization: `Bearer ${apiToken}` },
    }
  );
  return await response.text();
}

// Function to write a key-value pair
async function writeKey(accountId, namespaceId, apiToken, key, value) {
  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${key}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: value,
    }
  );
}

// Migration script
(async () => {
  const keys = await listKeys(sourceAccountId, sourceNamespaceId, sourceApiToken);
  for (const { name: key } of keys) {
    const value = await getValue(sourceAccountId, sourceNamespaceId, sourceApiToken, key);
    await writeKey(destinationAccountId, destinationNamespaceId, destinationApiToken, key, value);
    console.log(`Migrated: ${key}`);
  }
})();

