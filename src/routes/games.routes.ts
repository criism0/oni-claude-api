import { Router } from 'express';
import { createGame, getGame, startGame } from '../controllers/games.controller';

const router = Router();

router.post('/', createGame);
router.get('/:id', getGame);
router.patch('/:id/start', startGame);

export default router;
