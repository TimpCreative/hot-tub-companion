import { validateEnv } from './config/environment';
import { initFirebase } from './config/firebase';
import app from './app';
import { env } from './config/environment';

validateEnv();
initFirebase();

app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${env.PORT}`);
});
