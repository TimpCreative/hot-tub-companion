import { validateEnv } from './config/environment';
import { initFirebase } from './config/firebase';
import app from './app';
import { env } from './config/environment';
import { registerPosAdapter } from './services/posAdapterRegistry';
import { shopifyAdapter } from './integrations/shopifyAdapter';

validateEnv();
initFirebase();

// Register POS adapters
registerPosAdapter('shopify', shopifyAdapter);

app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${env.PORT}`);
});
