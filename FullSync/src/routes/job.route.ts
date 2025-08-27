import { Router, Request, Response, NextFunction } from 'express';
import { post } from '../controllers/job.controller';

const jobRouter: Router = Router();

jobRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await post(req, res, next);
  } catch (err) {
    next(err);
  }
});

export default jobRouter;
