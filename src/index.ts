import 'dotenv/config';
import { httpServer } from './app';
import { initSocket } from './socket';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`OniClaude API corriendo en http://localhost:${PORT}`);
});
