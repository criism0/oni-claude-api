import 'dotenv/config';
import { httpServer } from './app';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

httpServer.listen(PORT, () => {
  console.log(`OniClaude API corriendo en http://localhost:${PORT}`);
});
