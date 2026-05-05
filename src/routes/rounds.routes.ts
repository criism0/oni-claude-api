import { Router } from 'express';
import { getRound, submitGuess } from '../controllers/rounds.controller';

const router = Router();

router.get('/:id', getRound);
router.post('/:id/guess', submitGuess);

export default router;
