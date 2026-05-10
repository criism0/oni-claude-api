import { Router } from 'express';
import { createGame, getGame, getMyGames, startGame } from '../controllers/games.controller';

const router = Router();

router.post('/', createGame);
router.get('/me', getMyGames);
router.get('/:id', getGame);
router.patch('/:id/start', startGame);

export default router;
