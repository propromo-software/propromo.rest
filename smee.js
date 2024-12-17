const SmeeClient = require('smee-client');
const { SMEE_SOURCE } = process.env;

const smee = new SmeeClient({
  source: SMEE_SOURCE,
  target: 'http://localhost:3333/v1/github/webhooks',
  logger: console
});

/* const events = */ smee.start();

// Stop forwarding events
// events.close()
