import * as dotenv from 'dotenv';
dotenv.config();

import express, { Express } from 'express';
import morgan from 'morgan';

import JobRoutes from './routes/job.route';
import { readConfiguration } from './utils/config.utils';
import { errorMiddleware } from './middleware/error.middleware';
import CustomError from './errors/custom.error';

readConfiguration();

const app: Express = express();
app.disable('x-powered-by');

app.use(express.json());
app.use(morgan('dev'));

app.use('/job', JobRoutes);

app.use('*', () => {
  throw new CustomError(404, 'Path not found.');
});

app.use(errorMiddleware);

export default app;
